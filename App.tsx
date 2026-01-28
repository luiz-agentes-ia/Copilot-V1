
import React, { useState, createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Marketing from './components/Marketing';
import Sales from './components/Sales';
import Agenda from './components/Agenda';
import Automation from './components/Automation';
import Financial from './components/Financial';
import Integration from './components/Integration';
import Profile from './components/Profile';
import { AppSection, DateRange, ConsolidatedMetrics, FinancialEntry, Lead, Appointment, WhatsappConfig } from './types';
import { Menu, X, Bot, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';

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
  
  // Tokens Específicos
  googleCalendarToken: string | null;
  googleAdsToken: string | null;
  googleSheetsToken: string | null;
  whatsappConfig: WhatsappConfig | null;
  
  // Setters
  setGoogleCalendarToken: (token: string | null) => void;
  setGoogleAdsToken: (token: string | null) => void;
  setGoogleSheetsToken: (token: string | null) => void;
  setWhatsappConfig: (config: WhatsappConfig | null) => void;
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
  updateLead: (lead: Lead) => Promise<void>;
  appointments: Appointment[];
  addAppointment: (apt: Appointment) => Promise<void>;
  updateAppointment: (apt: Appointment) => Promise<void>;
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
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [dateFilter, setInternalDateFilter] = useState<DateRange>(calculateRange('7 dias'));
  
  // Data State (Single Source of Truth)
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  // Tokens & Configs
  const [googleCalendarToken, setGoogleCalendarToken] = useState<string | null>(localStorage.getItem('google_calendar_token'));
  const [googleAdsToken, setGoogleAdsToken] = useState<string | null>(localStorage.getItem('google_ads_token'));
  const [googleSheetsToken, setGoogleSheetsToken] = useState<string | null>(localStorage.getItem('google_sheets_token'));
  
  // Load Whatsapp Config from LocalStorage
  const [whatsappConfig, setWhatsappConfigState] = useState<WhatsappConfig | null>(() => {
    const saved = localStorage.getItem('whatsapp_config');
    return saved ? JSON.parse(saved) : null;
  });

  const setWhatsappConfig = (config: WhatsappConfig | null) => {
    setWhatsappConfigState(config);
    if (config) {
      localStorage.setItem('whatsapp_config', JSON.stringify(config));
    } else {
      localStorage.removeItem('whatsapp_config');
    }
  };

  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    'google-ads': !!googleAdsToken, 
    'wpp': !!whatsappConfig?.isConnected, 
    'sheets': !!googleSheetsToken, 
    'calendar': !!googleCalendarToken, 
    'crm': false
  });

  useEffect(() => {
    setIntegrations(prev => ({
      ...prev,
      'google-ads': !!googleAdsToken,
      'calendar': !!googleCalendarToken,
      'sheets': !!googleSheetsToken,
      'wpp': !!whatsappConfig?.isConnected
    }));
  }, [googleAdsToken, googleCalendarToken, googleSheetsToken, whatsappConfig]);

  // --- DATA FETCHING FUNCTIONS ---
  const fetchFinancials = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
        
      if (error) {
        console.error("Erro ao buscar transações:", error);
        return;
      }
      
      if (data) {
        const mapped = data.map((d: any) => ({ 
            ...d, 
            unitValue: Number(d.unit_value), 
            total: Number(d.total) 
        }));
        setFinancialEntries(mapped);
      }
    } catch (err) { console.error(err); }
  }, [user]);

  const fetchLeads = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
         console.error("Erro ao buscar leads:", error);
         return;
      }

      if (data) {
        const mapped = data.map((d: any) => ({ 
            ...d, 
            potentialValue: Number(d.potential_value), 
            lastMessage: d.last_message, 
            lastInteraction: '1d',
            email: d.email,
            procedure: d.procedure,
            notes: d.notes,
            source: d.source
        }));
        setLeads(mapped);
      }
    } catch (err) { console.error(err); }
  }, [user]);

  const fetchAppointments = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
          console.error("Erro ao buscar agendamentos:", error);
          return;
      }

      if (data) {
        const mapped = data.map((d: any) => ({ ...d, patientName: d.patient_name }));
        setAppointments(mapped);
      }
    } catch (err) { console.error(err); }
  }, [user]);

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    if (!isAuthenticated || !user || !supabase) return;

    fetchFinancials();
    fetchLeads();
    fetchAppointments();

    const channel = supabase.channel('main-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchFinancials())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchAppointments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user, fetchFinancials, fetchLeads, fetchAppointments]);

  // --- AUTH SESSION HANDLER ---
  useEffect(() => {
    if (!supabase) return;
    
    const handleSession = (session: any) => {
       setSession(session);
       setIsAuthenticated(!!session);
       
       if (session) {
          fetchUserProfile(session.user.id);
          const authIntent = localStorage.getItem('auth_intent');
          
          if (session.provider_token) {
             console.log("Token do provedor (Google) detectado com sucesso!");
             
             if (authIntent === 'google_ads') {
                setGoogleAdsToken(session.provider_token);
                localStorage.setItem('google_ads_token', session.provider_token);
                localStorage.removeItem('auth_intent');
             } 
             else if (authIntent === 'google_calendar') {
                setGoogleCalendarToken(session.provider_token);
                localStorage.setItem('google_calendar_token', session.provider_token);
                localStorage.removeItem('auth_intent');
             }
             else if (authIntent === 'google_sheets') {
                setGoogleSheetsToken(session.provider_token);
                localStorage.setItem('google_sheets_token', session.provider_token);
                localStorage.removeItem('auth_intent');
             }
          } else if (authIntent) {
              console.warn("Auth intent existe (" + authIntent + ") mas provider_token não veio na sessão.");
          }
       } else {
          setUser(null);
          setFinancialEntries([]);
          setLeads([]);
          setAppointments([]);
       }
       setAuthLoading(false);
    };

    // Verifica a sessão atual imediatamente
    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));
    
    // Ouve mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event);
        handleSession(session);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data } = await supabase!.from('profiles').select('*').eq('id', userId).single();
      if (data) {
        setUser({ id: data.id, name: data.name || 'Admin', email: data.email || '', clinic: data.clinic_name || 'Clínica', plan: 'pro', ticketValue: Number(data.ticket_value) || 450 });
      } else {
        setUser({ id: userId, name: 'Doutor(a)', email: 'admin@cozmos.com', clinic: 'Minha Clínica', plan: 'pro', ticketValue: 450 });
      }
    } catch (err) { console.error(err); }
  };

  const login = async (email: string, pass: string) => {
    try {
      const cleanEmail = email.trim();
      const { error } = await supabase!.auth.signInWithPassword({ email: cleanEmail, password: pass });
      if (error) throw error;
    } catch (err: any) {
      if (err.message.includes("Invalid login credentials")) throw new Error("E-mail ou senha incorretos.");
      if (err.message.includes("Email not confirmed")) throw new Error("Por favor, confirme seu e-mail antes de entrar.");
      throw err;
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const cleanEmail = email.trim();
    const { data, error } = await supabase!.auth.signUp({ 
        email: cleanEmail, 
        password: pass, 
        options: { data: { name } } 
    });
    
    if (error) throw error;

    if (data.user && !data.session) {
       throw new Error("Conta criada com sucesso! Verifique seu e-mail para ativar o acesso.");
    }
  };

  const logout = async () => { 
    try {
        await supabase!.auth.signOut(); 
    } catch (e) {
        console.warn("Erro ao desconectar do Supabase, forçando limpeza local", e);
    } finally {
        localStorage.clear(); 
        setGoogleAdsToken(null);
        setGoogleCalendarToken(null);
        setGoogleSheetsToken(null);
        setWhatsappConfig(null);
        setUser(null);
        setIsAuthenticated(false); 
    }
  };

  // ... (Resto das funções de CRUD: addFinancialEntry, updateFinancialEntry, etc.) ...
  
  // Financeiro
  const addFinancialEntry = async (entry: FinancialEntry) => {
    if (!user) return;
    const tempId = crypto.randomUUID();
    const newEntry = { ...entry, id: tempId };
    setFinancialEntries(prev => [newEntry, ...prev]);

    const { error } = await supabase!.from('transactions').insert([{
       user_id: user.id, type: entry.type, category: entry.category, name: entry.name,
       unit_value: entry.unitValue, total: entry.total, status: entry.status, date: entry.date
    }]);

    if (error) {
        setFinancialEntries(prev => prev.filter(e => e.id !== tempId));
        alert("Erro ao salvar. Tente novamente.");
    }
  };

  const updateFinancialEntry = async (entry: FinancialEntry) => {
    setFinancialEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
    const { error } = await supabase!.from('transactions').update({
       type: entry.type, category: entry.category, name: entry.name,
       unit_value: entry.unitValue, total: entry.total, status: entry.status, date: entry.date
    }).eq('id', entry.id);

    if (error) {
       fetchFinancials();
       alert("Erro ao atualizar transação.");
    }
  };

  const deleteFinancialEntry = async (id: string) => {
    const backup = [...financialEntries];
    setFinancialEntries(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase!.from('transactions').delete().eq('id', id);

    if (error) {
       setFinancialEntries(backup);
       alert("Erro ao excluir.");
    }
  };

  // Leads
  const addLead = async (lead: Lead) => {
    if (!user) return;
    const tempId = crypto.randomUUID();
    const newLead = { ...lead, id: tempId };
    setLeads(prev => [newLead, ...prev]);

    const { error } = await supabase!.from('leads').insert([{
        user_id: user.id, 
        name: lead.name, 
        phone: lead.phone, 
        status: lead.status,
        temperature: lead.temperature, 
        last_message: lead.lastMessage, 
        potential_value: lead.potentialValue,
        source: lead.source,
        email: lead.email,        // NEW
        procedure: lead.procedure, // NEW
        notes: lead.notes          // NEW
    }]);

    if (error) setLeads(prev => prev.filter(l => l.id !== tempId));
  };

  const updateLead = async (lead: Lead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? lead : l));
    const { error } = await supabase!.from('leads').update({
        name: lead.name, 
        phone: lead.phone, 
        status: lead.status,
        temperature: lead.temperature, 
        last_message: lead.lastMessage, 
        potential_value: lead.potentialValue,
        source: lead.source,
        email: lead.email,         // NEW
        procedure: lead.procedure, // NEW
        notes: lead.notes          // NEW
    }).eq('id', lead.id);
    
    if (error) fetchLeads();
  };

  // Agenda
  const addAppointment = async (apt: Appointment) => {
    if (!user) return;
    const tempId = crypto.randomUUID();
    const newApt = { ...apt, id: tempId };
    setAppointments(prev => [...prev, newApt]);

    const { error } = await supabase!.from('appointments').insert([{
        user_id: user.id, date: apt.date, time: apt.time,
        patient_name: apt.patientName, status: apt.status, type: apt.type
    }]);

    if (error) setAppointments(prev => prev.filter(a => a.id !== tempId));
  };

  const updateAppointment = async (apt: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === apt.id ? apt : a));
    const { error } = await supabase!.from('appointments').update({
        date: apt.date, time: apt.time,
        patient_name: apt.patientName, status: apt.status, type: apt.type
    }).eq('id', apt.id);
    
    if (error) fetchAppointments();
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    if (user.id !== 'demo-user' && supabase) {
      await supabase.from('profiles').update({
        name: updates.name, clinic_name: updates.clinic, ticket_value: updates.ticketValue
      }).eq('id', user.id);
    }
  };

  // --- CONSOLIDATED METRICS LOGIC ---
  const consolidatedMetrics = useMemo((): ConsolidatedMetrics => {
    const filteredEntries = financialEntries.filter(e => e.date >= dateFilter.start && e.date <= dateFilter.end && e.status === 'efetuada');
    const filteredLeads = leads.filter(l => l.created_at && l.created_at.split('T')[0] >= dateFilter.start && l.created_at.split('T')[0] <= dateFilter.end);
    const filteredAppointments = appointments.filter(a => a.date >= dateFilter.start && a.date <= dateFilter.end);

    const receitaBruta = filteredEntries.filter(e => e.type === 'receivable').reduce((acc, curr) => acc + curr.total, 0);
    const gastosOperacionais = filteredEntries.filter(e => e.type === 'payable' && e.category !== 'Marketing').reduce((acc, curr) => acc + curr.total, 0);
    const investimentoMktManual = filteredEntries.filter(e => e.type === 'payable' && e.category === 'Marketing').reduce((acc, curr) => acc + curr.total, 0);
    const finalMarketingSpend = investimentoMktManual; 
    const gastosTotais = gastosOperacionais + finalMarketingSpend;

    const leadsCount = filteredLeads.length || 0;
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
        cpl: (leadsCount > 0 && finalMarketingSpend > 0) ? finalMarketingSpend / leadsCount : 0,
        ctr: leadsCount > 0 ? 2.1 : 0
      },
      vendas: {
        conversas, agendamentos, comparecimento, vendas,
        taxaConversao: leadsCount > 0 ? (agendamentos / leadsCount) * 100 : 0,
        cac: agendamentos > 0 ? finalMarketingSpend / agendamentos : 0,
        cpv: vendas > 0 ? finalMarketingSpend / vendas : 0
      },
      financeiro: {
        receitaBruta, gastosTotais,
        lucroLiquido: receitaBruta - gastosTotais,
        roi: gastosTotais > 0 ? ((receitaBruta - gastosTotais) / gastosTotais) * 100 : 0,
        ticketMedio: vendas > 0 ? receitaBruta / vendas : 0
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

  if (authLoading) return <div className="min-h-screen bg-navy flex items-center justify-center"><Loader2 className="text-white animate-spin" size={48}/></div>;
  if (!isAuthenticated) return <AuthScreen onLogin={login} onSignUp={signUp} />;

  return (
    <AppContext.Provider value={{ 
      user, updateUser, isAuthenticated, login, signUp, logout, 
      integrations, 
      
      googleCalendarToken, setGoogleCalendarToken,
      googleAdsToken, setGoogleAdsToken,
      googleSheetsToken, setGoogleSheetsToken,
      
      whatsappConfig, setWhatsappConfig,

      toggleIntegration, 
      dateFilter, setDateFilter, metrics: consolidatedMetrics,
      financialEntries, addFinancialEntry, updateFinancialEntry, deleteFinancialEntry,
      leads, addLead, updateLead, 
      appointments, addAppointment, updateAppointment
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
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (isLogin) {
        await onLogin(email, pass);
      } else {
        await onSignUp(email, pass, name);
      }
    } catch (err: any) {
      if (err.message && err.message.includes("Conta criada com sucesso")) {
        setSuccessMsg(err.message);
        setIsLogin(true); 
      } else {
        setError(err.message || 'Erro ao processar autenticação.');
      }
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

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] rounded-2xl font-bold flex items-center gap-3">
              <ShieldCheck size={18} /> {successMsg}
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
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }} className="text-[11px] font-black text-slate-400 hover:text-navy uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto">
              {isLogin ? 'Não tem uma conta? Crie agora' : 'Já tem conta? Fazer login'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-slate-400 opacity-50"><ShieldCheck size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Criptografia de Ponta a Ponta</span></div>
            <div className="flex justify-center items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <a href="https://iatask.com.br/termo/" target="_blank" rel="noopener noreferrer" className="hover:text-navy transition-colors border-b border-transparent hover:border-navy">Termos de Serviço</a>
                <span className="text-slate-300">•</span>
                <a href="https://iatask.com.br/politica/" target="_blank" rel="noopener noreferrer" className="hover:text-navy transition-colors border-b border-transparent hover:border-navy">Política de Privacidade</a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
