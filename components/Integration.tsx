
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Calendar, 
  Zap, 
  Loader2,
  LogOut,
  Copy,
  Terminal,
  Database,
  AlertOctagon,
  ExternalLink,
  HelpCircle,
  FileSpreadsheet,
  MessageCircle,
  Network,
  Activity
} from 'lucide-react';
import { useApp } from '../App';
import { signInWithGoogleAds, getAccessibleCustomers } from '../services/googleAdsService';
import { signInWithGoogleCalendar } from '../services/googleCalendarService';
import { signInWithGoogleSheets } from '../services/googleSheetsService';
import { GoogleAdAccount } from '../types';
import { supabase } from '../lib/supabase';

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c3.11 0 5.71-1.03 7.61-2.81l-3.57-2.77c-.99.66-2.26 1.06-4.04 1.06-3.41 0-6.3-2.3-7.34-5.41H1.04v2.81C3.12 19.38 7.3 23 12 23z" fill="#34A853"/>
    <path d="M4.66 14.07c-.26-.77-.41-1.6-.41-2.47s.15-1.7.41-2.47V6.32H1.04C.38 7.64 0 9.13 0 10.7c0 1.57.38 3.06 1.04 4.38l3.62-2.81z" fill="#FBBC05"/>
    <path d="M12 4.19c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.03 15.11 0 12 0 7.3 0 3.12 3.62 1.04 8.07l3.62 2.81c1.04-3.11 3.93-5.41 7.34-5.41z" fill="#EA4335"/>
  </svg>
);

const Integration: React.FC = () => {
  const { integrations, googleCalendarToken, googleAdsToken, setGoogleAdsToken, setGoogleCalendarToken, googleSheetsToken, setGoogleSheetsToken } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<'google' | 'supabase'>('google');
  
  // Variáveis de Ambiente e URLs
  const currentOrigin = window.location.origin; 
  const currentRedirectUrl = (window.location.origin + window.location.pathname).replace(/\/$/, "");
  const supabaseProjectUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://seu-projeto.supabase.co';
  const supabaseCallbackUrl = `${supabaseProjectUrl}/auth/v1/callback`;

  // States Google
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAdAccount[]>([]);
  const [selectedGoogleAccountId, setSelectedGoogleAccountId] = useState<string>(localStorage.getItem('selected_google_account_id') || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- EFEITOS E HANDLERS ---
  useEffect(() => {
    if (googleAdsToken && googleAccounts.length === 0) {
      setLoading('google-ads');
      setErrorMsg(null);
      
      setTimeout(() => {
        // Chamamos a função sem precisar passar developer token (o servidor cuida disso)
        getAccessibleCustomers(googleAdsToken)
          .then(accounts => {
            setGoogleAccounts(accounts);
            if (accounts.length > 0 && !selectedGoogleAccountId) {
                handleSelectGoogleAccount(accounts[0].id);
            }
            setLoading(null);
          })
          .catch(err => {
            console.error("Erro Google:", err);
            setErrorMsg("Falha ao conectar. Verifique o console.");
            setLoading(null);
          });
      }, 1000);
    }
  }, [googleAdsToken]);

  const handleGoogleLogin = async () => {
    setLoading('google-ads');
    setErrorMsg(null);
    try {
      await signInWithGoogleAds();
    } catch (error: any) {
      alert("Erro ao conectar Google: " + error.message);
      setLoading(null);
    }
  };

  const handleSelectGoogleAccount = (id: string) => {
    setSelectedGoogleAccountId(id);
    localStorage.setItem('selected_google_account_id', id);
  };

  const handleGoogleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('google_ads_demo_mode');
    localStorage.removeItem('google_ads_token');
    localStorage.removeItem('selected_google_account_id');
    setGoogleAdsToken(null);
    setGoogleAccounts([]);
    setSelectedGoogleAccountId('');
    window.location.reload();
  };

  const handleCalendarLogin = async () => {
    setLoading('calendar');
    try {
      await signInWithGoogleCalendar();
    } catch (error: any) {
      alert("Erro ao conectar Google Calendar: " + error.message);
      setLoading(null);
    }
  }

  const handleCalendarLogout = () => {
    localStorage.removeItem('google_calendar_token');
    setGoogleCalendarToken(null);
    window.location.reload();
  }

  const handleSheetsLogin = async () => {
    setLoading('sheets');
    try {
        await signInWithGoogleSheets();
    } catch (error: any) {
        alert("Erro ao conectar Google Sheets: " + error.message);
        setLoading(null);
    }
  }

  const handleSheetsLogout = () => {
      localStorage.removeItem('google_sheets_token');
      setGoogleSheetsToken(null);
      window.location.reload();
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // --- Mapeamento de Status Visual ---
  const connectionStatus = [
    { id: 'google-ads', label: 'Google Ads', active: !!googleAdsToken, icon: <GoogleIcon size={18} /> },
    { id: 'calendar', label: 'G. Calendar', active: !!googleCalendarToken, icon: <Calendar size={18} /> },
    { id: 'sheets', label: 'G. Sheets', active: !!googleSheetsToken, icon: <FileSpreadsheet size={18} /> },
  ];

  // --- Render Helpers ---
  const renderGoogleAdsCard = () => (
    <div className="mt-4 space-y-3 animate-in fade-in">
      <div className={`p-3 rounded-xl border ${errorMsg ? 'bg-rose-50 border-rose-100' : 'bg-blue-50/50 border-blue-100'}`}>
          <p className={`text-[10px] font-bold uppercase flex items-center gap-1 mb-2 ${errorMsg ? 'text-rose-600' : 'text-blue-600'}`}>
              <Zap size={10} /> {errorMsg ? 'Erro na Conexão' : 'Conta Vinculada'}
          </p>
          
          {loading === 'google-ads' ? (
             <div className="flex items-center gap-2 text-xs text-blue-800">
               <Loader2 size={12} className="animate-spin"/> Buscando contas...
             </div>
          ) : errorMsg ? (
            <div className="flex items-start gap-2">
               <AlertOctagon size={16} className="text-rose-500 shrink-0 mt-0.5" />
               <div>
                  <p className="text-[10px] font-bold text-rose-700 leading-tight">{errorMsg}</p>
                  <p className="text-[9px] text-rose-500 mt-1 leading-tight">
                    Tente desconectar e conectar novamente.
                  </p>
               </div>
            </div>
          ) : googleAccounts.length > 0 ? (
            <div className="space-y-2">
                <p className="text-xs font-bold text-navy">Selecione a Conta:</p>
                <select 
                    value={selectedGoogleAccountId}
                    onChange={(e) => handleSelectGoogleAccount(e.target.value)}
                    className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs font-bold text-navy focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {googleAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.descriptiveName}</option>
                  ))}
                </select>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 italic">
               Nenhuma conta de anúncio encontrada vinculada a este e-mail.
            </div>
          )}
      </div>
      <button onClick={handleGoogleLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
          <LogOut size={12} /> Desconectar Google Ads
      </button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-navy">Central de Conexões</h2>
            <p className="text-slate-500 text-sm">Gerencie o acesso às suas fontes de dados.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Activity size={14} className="text-emerald-500" /> Status do Sistema: Online
        </div>
      </header>

      {/* DASHBOARD DE STATUS DO ECOSSISTEMA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-500">
        {connectionStatus.map((item) => (
            <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${item.active ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' : 'bg-white border-slate-100 opacity-60 grayscale-[0.5]'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${item.active ? 'bg-white shadow-sm text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {item.icon}
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                        <p className={`text-xs font-black ${item.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {item.active ? 'Conectado' : 'Pendente'}
                        </p>
                    </div>
                </div>
                {item.active && (
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                )}
            </div>
        ))}
      </div>

      <div className="h-px bg-slate-200 w-full"></div>

      {/* CARDS DE CONEXÃO (LADO A LADO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* GOOGLE ADS */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleAdsToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><GoogleIcon size={24} /></div>
              {googleAdsToken ? (
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span>
              ) : (
                <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>
              )}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Ads</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Conecte sua conta de anúncios para importar métricas de campanhas.</p>
            
            {googleAdsToken ? renderGoogleAdsCard() : (
              <button 
                onClick={handleGoogleLogin}
                disabled={!!loading}
                className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'google-ads' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}
              >
                {loading === 'google-ads' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* GOOGLE CALENDAR */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleCalendarToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><Calendar className="text-amber-500" /></div>
              {googleCalendarToken ? (
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span>
              ) : (
                <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>
              )}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Calendar</h3>
             <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Sincronize sua agenda para detectar ocupação e ociosidade.</p>
            
            {googleCalendarToken ? (
               <div className="mt-auto">
                 <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-700 font-bold mb-3 text-center">
                    Sincronização Automática
                 </div>
                 <button onClick={handleCalendarLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                     <LogOut size={12} /> Desconectar
                 </button>
               </div>
            ) : (
              <button 
                onClick={handleCalendarLogin}
                disabled={!!loading}
                className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'calendar' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}
              >
                {loading === 'calendar' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* GOOGLE SHEETS */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleSheetsToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><FileSpreadsheet className="text-emerald-500" /></div>
              {googleSheetsToken ? (
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span>
              ) : (
                <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>
              )}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Sheets</h3>
             <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Exporte leads e dados financeiros automaticamente para planilhas.</p>
            
            {googleSheetsToken ? (
               <div className="mt-auto">
                 <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-[10px] text-emerald-700 font-bold mb-3 text-center">
                    Permissão de Leitura/Escrita
                 </div>
                 <button onClick={handleSheetsLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                     <LogOut size={12} /> Desconectar
                 </button>
               </div>
            ) : (
              <button 
                onClick={handleSheetsLogin}
                disabled={!!loading}
                className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'sheets' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}
              >
                {loading === 'sheets' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* WHATSAPP API (PLACEHOLDER) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col group transition-all hover:border-navy">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><MessageCircle className="text-emerald-500" /></div>
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100">Beta</span>
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">WhatsApp Business</h3>
             <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Automação de atendimento via API Oficial ou QR Code.</p>
             <button className="mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 text-slate-400 flex items-center justify-center gap-2 cursor-not-allowed">
                Em Breve
              </button>
        </div>

        {/* CRM/WEBHOOKS (PLACEHOLDER) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col group transition-all hover:border-navy">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><Network className="text-indigo-500" /></div>
              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase border border-indigo-100">Webhook</span>
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">CRM & ERP Externo</h3>
             <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Envie leads para RD Station, HubSpot ou Salesforce.</p>
             <button className="mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 text-slate-400 flex items-center justify-center gap-2 cursor-not-allowed">
                Em Breve
              </button>
        </div>

      </div>
      
      {/* SEÇÃO DE CONFIGURAÇÃO SEPARADA (Abas) */}
      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm mt-10">
         <div className="bg-slate-50/50 border-b border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-navy text-white rounded-lg"><Terminal size={18} /></div>
                <h4 className="text-lg font-bold text-navy">Manual de Configuração (Desenvolvedor)</h4>
            </div>
            <p className="text-sm text-slate-500 mb-6">Siga estes passos apenas se você for o administrador técnico. É necessário configurar os redirecionamentos em cada plataforma.</p>
            
            {/* Abas */}
            <div className="flex gap-2 border-b border-slate-200">
                <button 
                    onClick={() => setActiveGuideTab('google')}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeGuideTab === 'google' ? 'border-navy text-navy bg-white rounded-t-xl' : 'border-transparent text-slate-400 hover:text-navy hover:bg-slate-100/50 rounded-t-xl'}`}
                >
                   <GoogleIcon size={14} /> Google Cloud
                </button>
                <button 
                    onClick={() => setActiveGuideTab('supabase')}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeGuideTab === 'supabase' ? 'border-navy text-navy bg-white rounded-t-xl' : 'border-transparent text-slate-400 hover:text-navy hover:bg-slate-100/50 rounded-t-xl'}`}
                >
                   <Database size={14} /> Supabase
                </button>
            </div>
         </div>

         <div className="p-8 min-h-[300px]">
            {/* CONTEÚDO GOOGLE */}
            {activeGuideTab === 'google' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h5 className="font-bold text-navy text-sm">Configuração do Google Cloud Console</h5>
                            <p className="text-xs text-slate-500 mt-1">Necessário para login Google, Google Ads e Google Calendar.</p>
                        </div>
                        <a href="https://console.cloud.google.com/apis/dashboard" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                            Abrir Console <ExternalLink size={12} />
                        </a>
                    </div>

                    {/* AVISO IMPORTANTE: ATIVAR APIS */}
                    <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <AlertOctagon className="text-amber-600 shrink-0 mt-1" size={20} />
                        <div>
                           <h6 className="text-xs font-black text-amber-800 uppercase tracking-wide">Ação Obrigatória: Ativar APIs na Biblioteca</h6>
                           <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                              Antes de autenticar, você deve acessar o menu <strong>"APIs e serviços" &gt; "Biblioteca"</strong> no Google Cloud e ativar manualmente as seguintes APIs:
                           </p>
                           <ul className="list-disc pl-4 mt-2 text-[11px] text-amber-800 font-bold">
                              <li>Google Ads API</li>
                              <li>Google Calendar API</li>
                              <li>Google Sheets API</li>
                           </ul>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">1. Authorized JavaScript Origins</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono text-navy border border-slate-200 truncate">{currentOrigin}</code>
                                    <button onClick={() => copyToClipboard(currentOrigin, 'origin')} className="p-2 bg-slate-200 rounded-lg text-slate-600 hover:bg-navy hover:text-white transition-colors">{copied === 'origin' ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 leading-tight">Adicione esta URL exata no campo "Origens JavaScript autorizadas" do seu Cliente OAuth 2.0.</p>
                            </div>
                            
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <label className="text-[10px] font-black text-emerald-700 uppercase block mb-2">2. Authorized Redirect URIs</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono text-emerald-800 border border-emerald-200 truncate font-bold">{supabaseCallbackUrl}</code>
                                    <button onClick={() => copyToClipboard(supabaseCallbackUrl, 'callback')} className="p-2 bg-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors">{copied === 'callback' ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button>
                                </div>
                                <p className="text-[10px] text-emerald-600 mt-2 leading-tight">Esta é a URL de callback do Supabase. O Google deve redirecionar para cá após o login.</p>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500 space-y-3 leading-relaxed">
                            <p><strong>Outros requisitos:</strong></p>
                            <ul className="list-disc pl-4 space-y-2">
                                <li>Configure a "Tela de permissão OAuth" (OAuth Consent Screen) como "Externa" para produção ou "Interna" para testes na organização.</li>
                                <li>Se o app estiver em modo "Testing", você precisa adicionar manualmente os e-mails de teste.</li>
                                <li>Para o Google Ads funcionar, o "Developer Token" deve ser de nível "Basic" ou "Standard". Tokens de teste funcionam apenas com contas de teste.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTEÚDO SUPABASE */}
            {activeGuideTab === 'supabase' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h5 className="font-bold text-navy text-sm">Configuração do Supabase Auth</h5>
                            <p className="text-xs text-slate-500 mt-1">Gerencia a lista de URLs permitidas para redirecionamento.</p>
                        </div>
                         <a href="https://supabase.com/dashboard/project/_/auth/url-configuration" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                            Abrir Supabase <ExternalLink size={12} />
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Site URL</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono text-navy border border-slate-200 truncate">{currentOrigin}</code>
                                    <button onClick={() => copyToClipboard(currentOrigin, 'site_url')} className="p-2 bg-slate-200 rounded-lg text-slate-600 hover:bg-navy hover:text-white transition-colors">{copied === 'site_url' ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button>
                                </div>
                            </div>
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">Redirect URLs (Additional)</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono text-navy border border-slate-200 truncate">{currentRedirectUrl}</code>
                                    <button onClick={() => copyToClipboard(currentRedirectUrl, 'redirect_urls')} className="p-2 bg-slate-200 rounded-lg text-slate-600 hover:bg-navy hover:text-white transition-colors">{copied === 'redirect_urls' ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 leading-tight">Adicione todas as URLs onde seu app pode ser acessado (localhost, produção, staging).</p>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500 space-y-3 leading-relaxed">
                            <p><strong>Configuração de Provedores:</strong></p>
                            <p>No menu <strong>Authentication &gt; Providers</strong>, você deve ativar o Google e colar o "Client ID" e "Client Secret" gerados no Google Cloud Console.</p>
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-800 text-[11px]">
                                <HelpCircle size={12} className="inline mr-1 mb-0.5"/>
                                O Supabase atua como intermediário. O Google redireciona para o Supabase, e o Supabase redireciona de volta para este App.
                            </div>
                        </div>
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Integration;
