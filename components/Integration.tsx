
import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  MessageCircle, 
  FileSpreadsheet, 
  Database, 
  CheckCircle2, 
  Calendar, 
  Zap, 
  ShieldCheck, 
  Lock,
  Loader2,
  LogOut,
  RefreshCw,
  AlertTriangle,
  Copy,
  Terminal,
  FileText,
  Globe,
  Laptop,
  ArrowRight,
  Key
} from 'lucide-react';
import { useApp } from '../App';
import { getMetaAdAccounts, getMetaCampaigns } from '../services/metaService';
import { signInWithGoogleAds, getAccessibleCustomers } from '../services/googleAdsService';
import { signInWithGoogleCalendar } from '../services/googleCalendarService';
import { MetaAdAccount, MetaCampaign, GoogleAdAccount } from '../types';
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
  const { integrations, toggleIntegration, metaToken, selectedMetaCampaigns, setSelectedMetaCampaigns, setMetaToken, googleCalendarToken, googleAdsToken, setGoogleAdsToken } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const currentUrl = window.location.origin; // URL do AI Studio
  
  // Pegar URL do projeto Supabase a partir das variaveis de ambiente ou usar fallback visual
  const supabaseUrlEnv = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://seu-projeto.supabase.co';
  const supabaseProjectUrl = supabaseUrlEnv; 
  const supabaseCallbackUrl = `${supabaseProjectUrl}/auth/v1/callback`;

  // States Meta
  const [metaAdAccounts, setMetaAdAccounts] = useState<MetaAdAccount[]>([]);
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  
  // States Google
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAdAccount[]>([]);

  // DEVELOPER TOKEN: 
  const DEV_TOKEN = (import.meta as any)?.env?.VITE_GOOGLE_ADS_DEV_TOKEN || 'SEU_DEVELOPER_TOKEN_AQUI';

  // --- GOOGLE HANDLERS ---
  useEffect(() => {
    // Se tiver token do Google Ads globalmente, busca as contas
    if (googleAdsToken && googleAccounts.length === 0) {
      setLoading('google-ads');
      // Pequeno delay para UX
      setTimeout(() => {
        getAccessibleCustomers(googleAdsToken, DEV_TOKEN)
          .then(accounts => {
            setGoogleAccounts(accounts);
            setLoading(null);
          })
          .catch(err => {
            console.error("Erro ao buscar contas Google:", err);
            // Mesmo com erro, tiramos o loading para não travar
            setLoading(null);
          });
      }, 1000);
    }
  }, [googleAdsToken]);

  const handleGoogleLogin = async () => {
    setLoading('google-ads');
    try {
      await signInWithGoogleAds();
    } catch (error: any) {
      alert("Erro ao conectar Google: " + error.message);
      setLoading(null);
    }
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

  const handleGoogleDemoMode = async () => {
    setLoading('google-ads');
    await new Promise(resolve => setTimeout(resolve, 1500));
    setGoogleAdsToken('demo_token_bypass');
    localStorage.setItem('google_ads_demo_mode', 'true');
    const accounts = await getAccessibleCustomers('demo', 'demo');
    setGoogleAccounts(accounts);
    setLoading(null);
  };

  const handleGoogleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('google_ads_demo_mode');
    localStorage.removeItem('google_ads_token');
    setGoogleAdsToken(null);
    setGoogleAccounts([]);
    window.location.reload();
  };

  // --- META LOGIC ---
  useEffect(() => {
    if (metaToken) {
      setLoading('meta-ads');
      getMetaAdAccounts(metaToken)
        .then(accounts => {
          setMetaAdAccounts(accounts);
          setLoading(null);
        })
        .catch((e) => {
          console.error(e);
          setLoading(null);
          if (e.message.includes('Session does not match')) {
            setMetaToken(null);
            localStorage.removeItem('meta_token');
          }
        });
    }
  }, [metaToken]);

  const handleMetaLogin = () => {
    const clientId = '1251859617003520'; 
    const redirectUri = window.location.origin + '/'; 
    const scope = 'ads_read,ads_management,business_management';
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=token`;
    window.location.href = authUrl;
  };

  const handleSelectMetaAccount = async (id: string) => {
    setLoading('meta-ads');
    try {
      localStorage.setItem('selected_meta_account_id', id);
      const camps = await getMetaCampaigns(id, metaToken!);
      setMetaCampaigns(camps);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const integrationList = [
    { id: 'google-ads', name: 'Google Ads', icon: <GoogleIcon size={24} />, connected: !!googleAdsToken },
    { id: 'meta-ads', name: 'Meta Ads', icon: <Instagram className="text-pink-600" />, connected: !!metaToken },
    { id: 'wpp', name: 'WhatsApp Business', icon: <MessageCircle className="text-emerald-500" />, connected: integrations['wpp'] },
    { id: 'calendar', name: 'Google Calendar', icon: <Calendar className="text-amber-500" />, connected: !!googleCalendarToken },
    { id: 'sheets', name: 'Google Sheets', icon: <FileSpreadsheet className="text-emerald-600" />, connected: integrations['sheets'] },
    { id: 'crm', name: 'CRM (Doctoralia)', icon: <Database className="text-indigo-500" />, connected: integrations['crm'] },
  ];

  const renderGoogleAdsCard = () => (
    <div className="mt-4 space-y-3 animate-in fade-in">
      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
          <p className="text-[10px] text-blue-600 font-bold uppercase flex items-center gap-1 mb-2">
              <Zap size={10} /> Conta Vinculada
          </p>
          {loading === 'google-ads' ? (
             <div className="flex items-center gap-2 text-xs text-blue-800">
               <Loader2 size={12} className="animate-spin"/> Buscando contas...
             </div>
          ) : googleAccounts.length > 0 ? (
            <div className="space-y-2">
                <p className="text-xs font-bold text-navy">Contas Encontradas:</p>
                <select className="w-full p-2 bg-white border border-blue-100 rounded-lg text-xs font-bold text-navy focus:outline-none">
                  {googleAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.descriptiveName}</option>
                  ))}
                </select>
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 italic">Conexão estabelecida, buscando contas...</p>
          )}
      </div>
      <button onClick={handleGoogleLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
          <LogOut size={12} /> Desconectar
      </button>
    </div>
  );

  const renderMetaAdsCard = () => (
    <div className="mt-4 space-y-2 animate-in fade-in">
      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-bold uppercase mb-2">Selecione a Conta:</p>
          <select 
            onChange={(e) => handleSelectMetaAccount(e.target.value)}
            className="w-full p-2 bg-white border border-emerald-100 rounded-lg text-xs font-bold text-navy focus:outline-none"
            disabled={loading === 'meta-ads'}
          >
            <option value="">Carregando contas...</option>
            {metaAdAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
      </div>
      {metaCampaigns.length > 0 && (
          <p className="text-[9px] text-center text-slate-400 font-bold uppercase mt-2">{metaCampaigns.length} Campanhas Encontradas</p>
      )}
      <button onClick={() => { setMetaToken(null); localStorage.removeItem('meta_token'); }} className="w-full mt-4 py-3 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-xl transition-all">Desconectar Meta</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-navy">Central de Conexões</h2>
        <p className="text-slate-500 text-sm">Integre suas ferramentas com apenas um clique.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrationList.map((item) => (
          <div key={item.id} className={`bg-white p-8 rounded-3xl border shadow-sm flex flex-col group transition-all ${item.connected ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors">{item.icon}</div>
              {item.connected ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={12} /> Conectado</span>
              ) : (
                <span className="text-[10px] font-black text-slate-300 bg-slate-50 px-3 py-1.5 rounded-full uppercase border border-slate-100">Desconectado</span>
              )}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">{item.name}</h3>
            
            {/* RENDERIZAÇÃO ESTRITA POR TIPO DE INTEGRAÇÃO */}
            {item.id === 'google-ads' && item.connected ? (
                renderGoogleAdsCard()
            ) : item.id === 'meta-ads' && item.connected ? (
                renderMetaAdsCard()
            ) : item.id === 'calendar' && item.connected ? (
               <div className="mt-4">
                 <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-700 font-bold">
                    Sincronização Ativa
                 </div>
                 <button onClick={() => { localStorage.removeItem('google_calendar_token'); window.location.reload(); }} className="w-full mt-2 py-2 text-[10px] font-black uppercase text-rose-400">Desconectar</button>
               </div>
            ) : !item.connected && (
              <div className="mt-8 space-y-3">
                <button 
                  onClick={() => {
                      if (item.id === 'meta-ads') handleMetaLogin();
                      else if (item.id === 'google-ads') handleGoogleLogin();
                      else if (item.id === 'calendar') handleCalendarLogin();
                      else toggleIntegration(item.id);
                  }}
                  disabled={!!loading}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === item.id ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}
                >
                  {loading === item.id ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
                </button>

                {item.id === 'google-ads' && (
                  <button 
                    onClick={handleGoogleDemoMode}
                    disabled={!!loading}
                    className="w-full text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-navy hover:underline decoration-dashed underline-offset-4 transition-all"
                  >
                    Problemas com login? Usar Modo Demo
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* GUIA DE CONFIGURAÇÃO PASSO A PASSO */}
      <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in slide-in-from-bottom-4">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-navy text-white rounded-lg"><Terminal size={18} /></div>
            <h4 className="text-sm font-bold text-navy uppercase tracking-wide">Configuração do Ambiente (Google & Supabase)</h4>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* PASSO 1: GOOGLE CLOUD */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 bg-blue-50 rounded-bl-xl text-blue-600 font-black text-[10px] uppercase">Passo 1</div>
               <h5 className="text-xs font-black text-navy uppercase mb-4 flex items-center gap-2"><Globe size={14}/> Google Cloud (Origens)</h5>
               <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Em <strong>Credenciais (OAuth 2.0)</strong>, adicione estas URLs para evitar erros de bloqueio (CORS):
               </p>

               <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Origens JS Autorizadas</label>
                    <div className="flex gap-2">
                       <code className="flex-1 bg-slate-50 p-2 rounded text-[10px] font-mono text-navy border border-slate-100 truncate">{currentUrl}</code>
                       <button onClick={() => copyToClipboard(currentUrl, 'origin')} className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-500">
                          {copied === 'origin' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                       </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-emerald-600 uppercase block mb-1 flex items-center gap-1"><Zap size={10} fill="currentColor"/> Callback (Redirecionamento)</label>
                    <div className="flex gap-2">
                       <code className="flex-1 bg-emerald-50 p-2 rounded text-[10px] font-mono text-emerald-800 border border-emerald-100 truncate font-bold">{supabaseCallbackUrl}</code>
                       <button onClick={() => copyToClipboard(supabaseCallbackUrl, 'callback')} className="p-2 bg-emerald-100 hover:bg-emerald-200 rounded text-emerald-600">
                          {copied === 'callback' ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
                       </button>
                    </div>
                  </div>
               </div>
            </div>

            {/* PASSO 2: SUPABASE AUTH */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 bg-indigo-50 rounded-bl-xl text-indigo-600 font-black text-[10px] uppercase">Passo 2</div>
               <h5 className="text-xs font-black text-navy uppercase mb-4 flex items-center gap-2"><Database size={14}/> Supabase (URL Config)</h5>
               <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Em <strong>Authentication &gt; URL Configuration</strong>, permita que o Supabase redirecione para cá:
               </p>

               <div>
                 <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Redirect URLs (Allow list)</label>
                 <div className="flex gap-2">
                    <code className="flex-1 bg-slate-50 p-2 rounded text-[10px] font-mono text-navy border border-slate-100 truncate">{currentUrl}/</code>
                    <button onClick={() => copyToClipboard(currentUrl + '/', 'allowlist')} className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-500">
                       {copied === 'allowlist' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                    </button>
                 </div>
               </div>
            </div>

            {/* PASSO 3: CHAVES NO SUPABASE */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden ring-1 ring-emerald-500/20">
               <div className="absolute top-0 right-0 p-2 bg-emerald-500 text-white rounded-bl-xl font-black text-[10px] uppercase">Passo 3</div>
               <h5 className="text-xs font-black text-navy uppercase mb-4 flex items-center gap-2"><Key size={14}/> Supabase (Providers)</h5>
               <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Em <strong>Authentication &gt; Providers &gt; Google</strong>, cole as chaves geradas no Google Cloud:
               </p>

               <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Client ID</p>
                     <p className="text-[9px] text-slate-300">(Cole do Google Cloud)</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Client Secret</p>
                     <p className="text-[9px] text-slate-300">(Cole do Google Cloud)</p>
                  </div>
                  <p className="text-[9px] text-emerald-600 font-bold text-center mt-2 flex items-center justify-center gap-1">
                     <CheckCircle2 size={10}/> Ativar Provider
                  </p>
               </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default Integration;
