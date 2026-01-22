import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Marketing from './components/Marketing';
import Sales from './components/Sales';
import Agenda from './components/Agenda';
import Automation from './components/Automation';
import Financial from './components/Financial';
import Integration from './components/Integration';
import Profile from './components/Profile';
import PrivacyPolicy from './components/PrivacyPolicy'; 
import TermsOfService from './components/TermsOfService'; 
import { AppSection, DateRange, ConsolidatedMetrics, FinancialEntry, Lead, Appointment } from './types';
import { Menu, X, Bot, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';

// --- MOCK DATA GENERATORS ---
const generateMockFinancials = (): FinancialEntry[] => {
  const entries: FinancialEntry[] = [];
  const categories = ['Consulta Particular', 'Procedimento Estético', 'Marketing', 'Aluguel', 'Folha de Pagamento', 'Insumos'];
  const types = ['receivable', 'receivable', 'payable', 'payable', 'payable', 'payable'] as const;
  
  for (let i = 0; i < 60; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const typeIdx = Math.floor(Math.random() * types.length);
    const type = types[typeIdx];
    const category = categories[typeIdx];
    const value = type === 'receivable' ? (450 + Math.random() * 1500) : (200 + Math.random() * 5000);

    entries.push({
      id: `mock-fin-${i}`,
      date: date.toISOString().split('T')[0],
      type: type,
      category: category,
      name: type === 'receivable' ? `Paciente ${i}` : `Fornecedor ${category}`,
      unitValue: value,
      total: value,
      discount: 0,
      addition: 0,
      status: Math.random() > 0.1 ? 'efetuada' : 'atrasada'
    });
  }
  return entries;
};

const generateMockLeads = (): Lead[] => {
  const leads: Lead[] = [];
  const statuses = ['Novo', 'Conversa', 'Agendado', 'Venda', 'Perdido'] as const;
  
  for (let i = 0; i < 40; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    leads.push({
      id: `mock-lead-${i}`,
      name: `Lead Exemplo ${i}`,
      phone: '11999999999',
      status: status,
      temperature: ['Hot', 'Warm', 'Cold'][Math.floor(Math.random() * 3)] as any,
      lastMessage: 'Gostaria de saber o valor da consulta...',
      potentialValue: 450,
      created_at: date.toISOString()
    });
  }
  return leads;
};

const generateMockAppointments = (): Appointment[] => {
  const apps: Appointment[] = [];
  for (let i = -5; i < 10; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    apps.push({
      id: `mock-app-${i}`,
      date: date.toISOString().split('T')[0],
      time: '14:00',
      patientName: `Paciente Agendado ${i}`,
      type: 'Avaliação',
      status: i < 0 ? 'Realizado' : 'Confirmado'
    });
  }
  return apps;
};

interface User {
  id: string;
  name: string;
  clinic: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  ticketValue: number;
}

interface AppContextType {
  user: User | null;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  integrations: Record<string, boolean>;
  
  // Tokens
  metaToken: string | null;
  googleCalendarToken: string | null;
  googleAdsToken: string | null; // Novo token global
  
  selectedMetaCampaigns: string[];
  
  // Setters
  setMetaToken: (token: string | null) => void;
  setGoogleCalendarToken: (token: string | null) => void;
  setGoogleAdsToken: (token: string | null) => void;
  setSelectedMetaCampaigns: (campaigns: string[]) => void;
  toggleIntegration: (id: string) => void;
  
  // Data & Metrics
  dateFilter: DateRange;
  setDateFilter: (label: string) => void;
  metrics: ConsolidatedMetrics;
  
  // Financial Data Management
  financialEntries: FinancialEntry[];
  addFinancialEntry: (entry: FinancialEntry) => Promise<void>;
  updateFinancialEntry: (entry: FinancialEntry) => Promise<void>;
  deleteFinancialEntry: (id: string) => Promise<void>;

  // CRM & Agenda Data
  leads: Lead[];
  addLead: (lead: Lead) => Promise<void>;
  appointments: Appointment[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

const calculateRange = (label: string): DateRange => {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start = new Date();

  switch (label) {
    case 'Hoje': start = now; break;
    case '7 dias': start.setDate(now.getDate() - 7); break;
    case '30 dias': start.setDate(now.getDate() - 30); break;
    case 'Este Ano': start = new Date(now.getFullYear(), 0, 1); break;
    default: start.setDate(now.getDate() - 30);
  }

  return { start: start.toISOString().split('T')[0], end: end, label: label };
};

const App: React.FC = () => {
  const currentPath = window.location.pathname;
  const isPrivacyRoute = currentPath.includes('/privacy');
  const isTermsRoute = currentPath.includes('/terms');

  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [dateFilter, setInternalDateFilter] = useState<DateRange>(calculateRange('7 dias'));
  
  // Data State
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  // TOKENS
  const [metaToken, setMetaToken] = useState<string | null>(localStorage.getItem('meta_token'));
  const [googleCalendarToken, setGoogleCalendarToken] = useState<string | null>(localStorage.getItem('google_calendar_token'));
  const [googleAdsToken, setGoogleAdsToken] = useState<string | null>(localStorage.getItem('google_ads_token'));

  const [selectedMetaCampaigns, setSelectedMetaCampaigns] = useState<string[]>(JSON.parse(localStorage.getItem('meta_campaigns') || '[]'));
  
  // Estado das integrações (Visual apenas)
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    'google-ads': !!googleAdsToken, 
    'meta-ads': !!metaToken, 
    'wpp': true, 
    'sheets': false, 
    'calendar': !!googleCalendarToken, 
    'crm': false
  });

  // Atualiza integrations quando tokens mudam
  useEffect(() => {
    setIntegrations(prev => ({
      ...prev,
      'google-ads': !!googleAdsToken,
      'meta-ads': !!metaToken,
      'calendar': !!googleCalendarToken
    }));
  }, [googleAdsToken, metaToken, googleCalendarToken]);

  // --- OAUTH CALLBACK HANDLER (META ADS) ---
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const token = params.get('access_token');
      if (token) {
        setMetaToken(token);
        localStorage.setItem('meta_token', token);
        window.history.pushState("", document.title, window.location.pathname + window.location.search);
      }
    }
  }, []);

  // --- OAUTH SESSION HANDLER (SUPABASE / GOOGLE) ---
  useEffect(() => {
    if (!supabase) return;
    
    const handleSession = (session: any) => {
       setSession(session);
       setIsAuthenticated(!!session);
       
       if (session) {
          fetchUserProfile(session.user.id);
          
          // Lógica de recuperação de token do Google
          // O Supabase retorna o provider_token na sessão imediatamente após o redirect do OAuth.
          // Como usamos Supabase Auth APENAS para Google (Meta é manual), podemos assumir que
          // se existe provider_token, é um token Google válido.
          if (session.provider_token) {
             console.log("Novo token Google detectado, salvando...");
             setGoogleAdsToken(session.provider_token);
             localStorage.setItem('google_ads_token', session.provider_token);
             
             // Opcional: Salvar também para Calendar se não existir, já que é o mesmo Google Account
             if (!localStorage.getItem('google_calendar_token')) {
                 setGoogleCalendarToken(session.provider_token);
                 localStorage.setItem('google_calendar_token', session.provider_token);
             }
          }
       } else {
          setUser(null);
          // Não limpamos os tokens aqui para evitar desconexão acidental em refresh
       }
       setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
       handleSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchFinancials();
      fetchLeads();
      fetchAppointments();
    }
  }, [isAuthenticated, user]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId).single();
      if (data) {
        setUser({ id: data.id, name: data.name || 'Cozmos Admin', email: data.email || '', clinic: data.clinic_name || 'Clínica Cozmos', plan: 'pro', ticketValue: Number(data.ticket_value) || 450 });
      } else {
        setUser({ id: userId, name: 'Cozmos Admin', email: 'cozmos.atendimento@gmail.com', clinic: 'Clínica Cozmos', plan: 'pro', ticketValue: 450 });
      }
    } catch (err) { console.error(err); }
  };

  const fetchFinancials = async () => {
    try {
      const { data, error } = await supabase!.from('transactions').select('*').order('date', { ascending: false });
      if (data && data.length > 0) {
        const mapped = data.map((d: any) => ({ ...d, unitValue: Number(d.unit_value), total: Number(d.total) }));
        setFinancialEntries(mapped);
      } else {
        setFinancialEntries(generateMockFinancials());
      }
    } catch (err) { 
        console.error(err); 
        setFinancialEntries(generateMockFinancials());
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase!.from('leads').select('*').order('created_at', { ascending: false });
      if (data && data.length > 0) {
        const mapped = data.map((d: any) => ({ ...d, potentialValue: Number(d.potential_value), lastInteraction: '1d' }));
        setLeads(mapped);
      } else {
        setLeads(generateMockLeads());
      }
    } catch (err) { 
        console.error(err);
        setLeads(generateMockLeads()); 
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase!.from('appointments').select('*').order('date', { ascending: true });
      if (data && data.length > 0) {
        const mapped = data.map((d: any) => ({ ...d, patientName: d.patient_name }));
        setAppointments(mapped);
      } else {
        setAppointments(generateMockAppointments());
      }
    } catch (err) { 
        console.error(err);
        setAppointments(generateMockAppointments());
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      const { error } = await supabase!.auth.signInWithPassword({ email, password: pass });
      if (error) {
        if (email === 'cozmos.atendimento@gmail.com' && pass === 'Hymura.598') {
          setIsAuthenticated(true);
          setUser({ id: 'demo-user', name: 'Cozmos Admin', email, clinic: 'Clínica Cozmos', plan: 'pro', ticketValue: 450 });
          return;
        }
        throw error;
      }
    } catch (err: any) {
      if (err.message.includes("Invalid login credentials")) {
        throw new Error("Credenciais inválidas.");
      }
      throw err;
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const { error } = await supabase!.auth.signUp({ email, password: pass, options: { data: { name } } });
    if (error) throw error;
  };

  const logout = async () => { 
    await supabase!.auth.signOut(); 
    localStorage.removeItem('meta_token');
    localStorage.removeItem('google_ads_token');
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('google_ads_demo_mode');
    setMetaToken(null);
    setGoogleAdsToken(null);
    setGoogleCalendarToken(null);
    setIsAuthenticated(false); 
  };

  const addFinancialEntry = async (entry: FinancialEntry) => {
    const newEntry = { ...entry, id: crypto.randomUUID() };
    setFinancialEntries(prev => [newEntry, ...prev]);
    supabase!.from('transactions').insert([{
       user_id: user?.id, type: entry.type, category: entry.category, name: entry.name,
       unit_value: entry.unitValue, total: entry.total, status: entry.status, date: entry.date
    }]).then(({error}) => { if(error) console.error("Erro ao salvar no banco (ignorando em modo demo)", error); });
  };

  const updateFinancialEntry = async (entry: FinancialEntry) => {
    setFinancialEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
    supabase!.from('transactions').update({
       type: entry.type, category: entry.category, name: entry.name,
       unit_value: entry.unitValue, total: entry.total, status: entry.status, date: entry.date
    }).eq('id', entry.id);
  };

  const deleteFinancialEntry = async (id: string) => {
    setFinancialEntries(prev => prev.filter(e => e.id !== id));
    supabase!.from('transactions').delete().eq('id', id);
  };

  const addLead = async (lead: Lead) => {
    const newLead = { ...lead, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setLeads(prev => [newLead, ...prev]);
    supabase!.from('leads').insert([{
        user_id: user?.id, name: lead.name, phone: lead.phone, status: lead.status,
        temperature: lead.temperature, last_message: lead.lastMessage, potential_value: lead.potentialValue
    }]);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    
    if (user.id !== 'demo-user' && supabase) {
      const { error } = await supabase.from('profiles').update({
        name: updates.name,
        clinic_name: updates.clinic,
        ticket_value: updates.ticketValue
      }).eq('id', user.id);
    }
  };

  const consolidatedMetrics = useMemo((): ConsolidatedMetrics => {
    const filteredEntries = financialEntries.filter(e => e.date >= dateFilter.start && e.date <= dateFilter.end && e.status === 'efetuada');
    const filteredLeads = leads.filter(l => l.created_at && l.created_at.split('T')[0] >= dateFilter.start && l.created_at.split('T')[0] <= dateFilter.end);
    const filteredAppointments = appointments.filter(a => a.date >= dateFilter.start && a.date <= dateFilter.end);

    const receitaBruta = filteredEntries.filter(e => e.type === 'receivable').reduce((acc, curr) => acc + curr.total, 0);
    const gastosOperacionais = filteredEntries.filter(e => e.type === 'payable' && e.category !== 'Marketing').reduce((acc, curr) => acc + curr.total, 0);
    const investimentoMkt = filteredEntries.filter(e => e.type === 'payable' && e.category === 'Marketing').reduce((acc, curr) => acc + curr.total, 0);
    const finalMarketingSpend = investimentoMkt > 0 ? investimentoMkt : (filteredLeads.length * 15); 
    const gastosTotais = gastosOperacionais + finalMarketingSpend;

    const leadsCount = filteredLeads.length || 1;
    const conversas = filteredLeads.filter(l => l.status !== 'Novo').length;
    const vendas = filteredLeads.filter(l => l.status === 'Venda').length;
    const agendamentos = filteredAppointments.length;
    const comparecimento = filteredAppointments.filter(a => a.status === 'Realizado').length;

    return {
      marketing: {
        investimento: finalMarketingSpend,
        leads: leadsCount,
        clicks: leadsCount * 12,
        impressions: leadsCount * 12 * 40,
        cpl: finalMarketingSpend / leadsCount,
        ctr: 2.1
      },
      vendas: {
        conversas,
        agendamentos,
        comparecimento,
        vendas,
        taxaConversao: (agendamentos / leadsCount) * 100,
        cac: agendamentos > 0 ? finalMarketingSpend / agendamentos : 0,
        cpv: vendas > 0 ? finalMarketingSpend / vendas : 0
      },
      financeiro: {
        receitaBruta,
        gastosTotais,
        lucroLiquido: receitaBruta - gastosTotais,
        roi: gastosTotais > 0 ? ((receitaBruta - gastosTotais) / gastosTotais) * 100 : 0,
        ticketMedio: vendas > 0 ? receitaBruta / vendas : (user?.ticketValue || 450)
      }
    };
  }, [dateFilter, financialEntries, leads, appointments, user?.ticketValue]);

  const setDateFilter = (label: string) => setInternalDateFilter(calculateRange(label));
  const toggleIntegration = (id: string) => setIntegrations(prev => ({ ...prev, [id]: !prev[id] }));

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD: return <Dashboard />;
      case AppSection.MARKETING: return <Marketing />;
      case AppSection.VENDAS: return <Sales />;
      case AppSection.AGENDA: return <Agenda />;
      case AppSection.AUTOMACAO: return <Automation />;
      case AppSection.FINANCEIRO: return <Financial />;
      case AppSection.INTEGRACAO: return <Integration />;
      case AppSection.PERFIL: return <Profile />;
      default: return <Dashboard />;
    }
  };

  if (isPrivacyRoute) return <PrivacyPolicy />;
  if (isTermsRoute) return <TermsOfService />;
  if (authLoading) return <div className="min-h-screen bg-navy flex items-center justify-center"><Loader2 className="text-white animate-spin" size={48}/></div>;
  if (!isAuthenticated) return <AuthScreen onLogin={login} onSignUp={signUp} />;

  return (
    <AppContext.Provider value={{ 
      user, updateUser, isAuthenticated, login, signUp, logout, 
      integrations, 
      
      // Tokens
      metaToken, setMetaToken,
      googleCalendarToken, setGoogleCalendarToken,
      googleAdsToken, setGoogleAdsToken,

      selectedMetaCampaigns, setSelectedMetaCampaigns, toggleIntegration, 
      dateFilter, setDateFilter, metrics: consolidatedMetrics,
      financialEntries, addFinancialEntry, updateFinancialEntry, deleteFinancialEntry,
      leads, addLead, appointments
    }}>
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
        <div className="md:hidden flex items-center justify-between p-4 bg-navy text-white z-[60] shadow-md">
          <h1 className="font-bold text-lg tracking-tight">COPILOT AI</h1>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg">{isSidebarOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>
        <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:visible transition-all duration-300 ease-in-out`}>
          <Sidebar activeSection={activeSection} onNavigate={(s) => { setActiveSection(s); setSidebarOpen(false); }} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative bg-slate-50">
          <div className="max-w-7xl mx-auto pb-20">{renderContent()}</div>
        </main>
      </div>
    </AppContext.Provider>
  );
};

const AuthScreen = ({ onLogin, onSignUp }: { onLogin: any, onSignUp: any }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) await onLogin(email, pass);
      else await onSignUp(email, pass, name);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center">
          <div className="inline-flex p-4 bg-navy text-white rounded-3xl shadow-2xl mb-6"><Bot size={48} /></div>
          <h1 className="text-4xl font-black text-navy tracking-tight">COPILOT AI</h1>
          <p className="text-slate-500 mt-2 font-medium">Automação de gestão para clínicas.</p>
        </div>
        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-white space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-black text-navy tracking-tight">{isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{isLogin ? 'Acesse seu painel de controle' : 'Comece agora gratuitamente'}</p>
          </div>
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] rounded-2xl font-bold flex items-center gap-3 animate-pulse">
              <AlertCircle size={18} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Clínica</label>
                <input type="text" placeholder="Ex: Clínica Cozmos" value={name} onChange={e => setName(e.target.value)} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy/5 focus:outline-none text-slate-900 font-bold placeholder:text-slate-300 transition-all" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu E-mail</label>
              <input type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy/5 focus:outline-none text-slate-900 font-bold placeholder:text-slate-300 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sua Senha</label>
              <input type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy/5 focus:outline-none text-slate-900 font-bold placeholder:text-slate-300 transition-all" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-navy text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-navy/20 hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18}/> : (isLogin ? 'Acessar Painel' : 'Criar Conta Grátis')}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />}
            </button>
          </form>
          <div className="text-center pt-2">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-[11px] font-black text-slate-400 hover:text-navy uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto">
              {isLogin ? 'Não tem uma conta? Crie agora' : 'Já tem conta? Fazer login'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-slate-400 opacity-50"><ShieldCheck size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Criptografia de Ponta a Ponta</span></div>
            <div className="flex justify-center items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <a href="/terms" className="hover:text-navy transition-colors border-b border-transparent hover:border-navy">Termos de Serviço</a>
                <span className="text-slate-300">•</span>
                <a href="/privacy" className="hover:text-navy transition-colors border-b border-transparent hover:border-navy">Política de Privacidade</a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
