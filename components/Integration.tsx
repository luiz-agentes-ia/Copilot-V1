
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Calendar, Zap, Loader2, LogOut, Copy, Terminal,
  AlertOctagon, ExternalLink, FileSpreadsheet, Activity, AlertCircle,
  Search, ArrowRight, DownloadCloud, Table, FileDown, ArrowLeft,
  LayoutList, Files, Settings, MessageCircle, Smartphone, Upload
} from 'lucide-react';
import { useApp } from '../App';
import { signInWithGoogleAds, getAccessibleCustomers } from '../services/googleAdsService';
import { signInWithGoogleCalendar } from '../services/googleCalendarService';
import { signInWithGoogleSheets, listSpreadsheets, getSpreadsheetDetails, getSheetData } from '../services/googleSheetsService';
import { initInstance, checkStatus } from '../services/whatsappService';
import { GoogleAdAccount, WhatsappConfig } from '../types';
import { supabase } from '../lib/supabase';

// Ícone do Google
const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c3.11 0 5.71-1.03 7.61-2.81l-3.57-2.77c-.99.66-2.26 1.06-4.04 1.06-3.41 0-6.3-2.3-7.34-5.41H1.04v2.81C3.12 19.38 7.3 23 12 23z" fill="#34A853"/>
    <path d="M4.66 14.07c-.26-.77-.41-1.6-.41-2.47s.15-1.7.41-2.47V6.32H1.04C.38 7.64 0 9.13 0 10.7c0 1.57.38 3.06 1.04 4.38l3.62-2.81z" fill="#FBBC05"/>
    <path d="M12 4.19c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.03 15.11 0 12 0 7.3 0 3.12 3.62 1.04 8.07l3.62 2.81c1.04-3.11 3.93-5.41 7.34-5.41z" fill="#EA4335"/>
  </svg>
);

interface ExtendedAdAccount extends GoogleAdAccount {
    isManager?: boolean;
}

const Integration: React.FC = () => {
  const { 
    googleCalendarToken, googleAdsToken, setGoogleAdsToken, setGoogleCalendarToken, 
    googleSheetsToken, setGoogleSheetsToken, 
    whatsappConfig, setWhatsappConfig,
    addLead, user 
  } = useApp();
  
  const [loading, setLoading] = useState<string | null>(null);
  
  // States WhatsApp
  const [wppQr, setWppQr] = useState<string | null>(null);
  const [wppStatus, setWppStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'QRCODE' | 'DISCONNECTED'>('IDLE');
  const [wppError, setWppError] = useState('');

  // Sheets States
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<{id: string, name: string} | null>(null);
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');
  const [importLoading, setImportLoading] = useState(false);

  // --- WHATSAPP LOGIC ---
  useEffect(() => {
      const loadSavedInstance = async () => {
          if (!user) return;
          
          try {
              // Adicionei um tratamento específico para ignorar o 404 se a tabela não existir
              // O maybeSingle() evita erros se voltar vazio, mas se a tabela não existir, o catch pega.
              const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

              if (error) {
                  // Se for erro de conexão ou tabela faltando, apenas logamos discretamente e assumimos desconectado
                  console.warn("Status WhatsApp: Tabela não encontrada ou erro de permissão (RLS). Assumindo desconectado.");
                  return;
              }

              if (data) {
                  // Se encontrou dados no banco, checa se está online na Evolution
                  try {
                      const status = await checkStatus(data.instance_name);
                      if (status.status === 'CONNECTED') {
                          setWhatsappConfig({ instanceName: data.instance_name, isConnected: true, apiKey: '', baseUrl: '' });
                          setWppStatus('CONNECTED');
                      } else {
                          // Existe no banco mas tá offline na API
                          setWhatsappConfig({ instanceName: data.instance_name, isConnected: false, apiKey: '', baseUrl: '' });
                          setWppStatus('DISCONNECTED');
                      }
                  } catch (apiError) {
                      console.warn("Erro ao checar status na Evolution:", apiError);
                      // Mantém estado do banco mas marca como erro visualmente se necessário
                  }
              }
          } catch (e) { 
             // Catch global para evitar crash da tela
             console.error("Erro crítico ao carregar WhatsApp:", e); 
          }
      };
      
      loadSavedInstance();
  }, [user]);

  const handleWppConnect = async () => {
    if (!user) return;
    setWppStatus('CONNECTING');
    setWppError('');
    setWppQr(null);
    try {
        const result = await initInstance(user.id, user.clinic);
        if (result.state === 'open') {
            setWppStatus('CONNECTED');
            setWhatsappConfig({ instanceName: result.instanceName, isConnected: true, apiKey: '', baseUrl: '' });
        } else if (result.base64) {
            setWppStatus('QRCODE');
            setWppQr(result.base64);
            const interval = setInterval(async () => {
                 const check = await checkStatus(result.instanceName);
                 if (check.status === 'CONNECTED') {
                     clearInterval(interval);
                     setWppStatus('CONNECTED');
                     setWppQr(null);
                     setWhatsappConfig({ instanceName: result.instanceName, isConnected: true, apiKey: '', baseUrl: '' });
                 }
            }, 3000);
            setTimeout(() => clearInterval(interval), 60000);
        } else {
            setWppStatus('DISCONNECTED');
            setWppError("Não foi possível gerar o QR Code.");
        }
    } catch (err: any) {
        setWppStatus('DISCONNECTED');
        setWppError(err.message || "Erro de conexão.");
    }
  };

  const handleWppDisconnect = async () => {
      setWhatsappConfig(null);
      setWppStatus('IDLE');
      setWppQr(null);
      if (user) {
          try { await supabase.from('whatsapp_instances').delete().eq('user_id', user.id); } catch (e) {}
      }
  };

  // --- SHEETS LOGIC ---
  useEffect(() => {
    if (googleSheetsToken) {
        setImportLoading(true);
        listSpreadsheets(googleSheetsToken)
            .then(files => {
                setSpreadsheets(files);
                setImportLoading(false);
            })
            .catch(e => {
                console.error(e);
                setImportLoading(false);
            });
    }
  }, [googleSheetsToken]);

  const handleSelectSpreadsheet = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      if (!id) return;
      const name = e.target.options[e.target.selectedIndex].text;
      setSelectedSpreadsheet({ id, name });
      setImportLoading(true);
      try {
          const tabs = await getSpreadsheetDetails(googleSheetsToken!, id);
          setSheetTabs(tabs);
          setSelectedTab(tabs[0] || '');
      } catch (e) {
          alert('Erro ao carregar abas.');
      } finally {
          setImportLoading(false);
      }
  };

  const handleImportLeads = async () => {
      if (!selectedSpreadsheet || !selectedTab) return;
      setImportLoading(true);
      setImportStatus('');
      try {
          const rows = await getSheetData(googleSheetsToken!, selectedSpreadsheet.id, selectedTab);
          if (rows.length < 2) throw new Error("Planilha vazia ou sem cabeçalho.");
          
          const header = rows[0].map((c: string) => c.toLowerCase());
          
          // Heurística simples para encontrar colunas
          let nameIdx = header.findIndex((h:string) => h.includes('nome') || h.includes('name') || h.includes('cliente'));
          let phoneIdx = header.findIndex((h:string) => h.includes('tel') || h.includes('cel') || h.includes('phone') || h.includes('whatsapp') || h.includes('contato'));
          
          if (nameIdx === -1) nameIdx = 0; // Fallback coluna A
          if (phoneIdx === -1) phoneIdx = 1; // Fallback coluna B

          let count = 0;
          for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row[nameIdx]) continue;
              
              await addLead({
                  id: '',
                  name: row[nameIdx],
                  phone: row[phoneIdx] || '',
                  status: 'Novo',
                  temperature: 'Cold',
                  source: 'Google Sheets',
                  lastMessage: 'Importado via Planilha'
              });
              count++;
          }
          setImportStatus(`${count} leads importados com sucesso!`);
          setTimeout(() => setImportStatus(''), 5000);
      } catch (e: any) {
          setImportStatus(`Erro: ${e.message}`);
      } finally {
          setImportLoading(false);
      }
  };

  // --- GOOGLE AUTH HANDLERS ---
  const handleGoogleLogin = async () => {
    setLoading('google-ads');
    try { await signInWithGoogleAds(); } catch (error: any) { alert("Erro: " + error.message); setLoading(null); }
  };
  const handleGoogleLogout = async () => { await supabase.auth.signOut(); localStorage.removeItem('google_ads_token'); setGoogleAdsToken(null); window.location.reload(); };
  
  const handleCalendarLogin = async () => { setLoading('calendar'); try { await signInWithGoogleCalendar(); } catch (e: any) { alert(e.message); setLoading(null); } };
  const handleCalendarLogout = () => { localStorage.removeItem('google_calendar_token'); setGoogleCalendarToken(null); window.location.reload(); };
  
  const handleSheetsLogin = async () => { setLoading('sheets'); try { await signInWithGoogleSheets(); } catch (e: any) { alert(e.message); setLoading(null); } };
  const handleSheetsLogout = () => { localStorage.removeItem('google_sheets_token'); setGoogleSheetsToken(null); setSpreadsheets([]); setSelectedSpreadsheet(null); window.location.reload(); };

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

      {/* DASHBOARD DE STATUS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-500">
        {[
            { id: 'google-ads', label: 'Google Ads', active: !!googleAdsToken, icon: <GoogleIcon size={18} /> },
            { id: 'calendar', label: 'G. Calendar', active: !!googleCalendarToken, icon: <Calendar size={18} /> },
            { id: 'sheets', label: 'G. Sheets', active: !!googleSheetsToken, icon: <FileSpreadsheet size={18} /> },
            { id: 'wpp', label: 'WhatsApp', active: !!whatsappConfig?.isConnected, icon: <MessageCircle size={18} /> },
        ].map((item) => (
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
            </div>
        ))}
      </div>

      <div className="h-px bg-slate-200 w-full"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* WHATSAPP CARD */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${whatsappConfig?.isConnected ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><MessageCircle size={24} className="text-emerald-600"/></div>
              {whatsappConfig?.isConnected ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">WhatsApp Business</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Conecte seu número para ativar a IA.</p>
            
            {whatsappConfig?.isConnected ? (
               <div className="mt-auto space-y-3">
                   <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <p className="text-[10px] font-bold text-emerald-800 flex items-center gap-2"><Smartphone size={12}/> {whatsappConfig.instanceName}</p>
                   </div>
                   <button onClick={handleWppDisconnect} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><LogOut size={12} /> Desconectar</button>
               </div>
            ) : (
               <div className="mt-auto space-y-3">
                   {(wppStatus === 'IDLE' || wppStatus === 'DISCONNECTED' || wppStatus === 'CONNECTING') ? (
                       <div className="space-y-3 animate-in fade-in">
                          {wppError && <p className="text-[9px] text-rose-500 font-bold bg-rose-50 p-2 rounded">{wppError}</p>}
                          <button onClick={handleWppConnect} disabled={wppStatus === 'CONNECTING'} className="w-full py-3 bg-navy text-white rounded-xl text-[10px] font-black uppercase flex justify-center items-center gap-2 hover:bg-slate-800 shadow-lg shadow-navy/20">
                              {wppStatus === 'CONNECTING' ? <Loader2 size={12} className="animate-spin" /> : 'Gerar QR Code'}
                          </button>
                       </div>
                   ) : wppStatus === 'QRCODE' && wppQr ? (
                       <div className="text-center space-y-2 animate-in zoom-in">
                           <p className="text-[10px] font-bold text-navy uppercase">Leia no WhatsApp</p>
                           <img src={wppQr} alt="QR Code" className="w-32 h-32 mx-auto border-4 border-white shadow-lg rounded-xl" />
                           <button onClick={() => setWppStatus('IDLE')} className="text-[9px] underline text-rose-400 mt-2">Cancelar</button>
                       </div>
                   ) : (
                       <div className="flex flex-col items-center py-4 text-slate-400">
                           <Loader2 size={24} className="animate-spin mb-2" />
                       </div>
                   )}
               </div>
            )}
        </div>

        {/* GOOGLE CALENDAR (RESTAURADO) */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleCalendarToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><Calendar className="text-amber-500" /></div>
              {googleCalendarToken ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Agenda</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Sincronize sua agenda médica.</p>
            {googleCalendarToken ? (
               <div className="mt-auto"><button onClick={handleCalendarLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><LogOut size={12} /> Desconectar</button></div>
            ) : (
              <button onClick={handleCalendarLogin} disabled={!!loading} className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'calendar' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}>
                {loading === 'calendar' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* SHEETS CARD */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleSheetsToken ? 'border-emerald-100 ring-1 ring-emerald-50 col-span-1 md:col-span-2' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><FileSpreadsheet className="text-emerald-500" /></div>
              {googleSheetsToken ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Planilhas Google</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4">Importe listas de leads diretamente.</p>
            
            {googleSheetsToken ? (
               <div className="mt-auto space-y-4 animate-in fade-in">
                   <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                       {importStatus && <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded mb-2">{importStatus}</p>}
                       
                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase">Arquivo</label>
                               <select onChange={handleSelectSpreadsheet} className="w-full mt-1 p-2 text-xs border rounded bg-white">
                                   <option value="">Selecione...</option>
                                   {spreadsheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                               </select>
                           </div>
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase">Aba</label>
                               <select onChange={e => setSelectedTab(e.target.value)} value={selectedTab} disabled={!selectedSpreadsheet} className="w-full mt-1 p-2 text-xs border rounded bg-white">
                                   {sheetTabs.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                           </div>
                       </div>
                       
                       <button 
                           onClick={handleImportLeads} 
                           disabled={importLoading || !selectedTab}
                           className="w-full bg-navy text-white py-2 rounded-lg text-[10px] font-bold uppercase flex justify-center items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
                       >
                           {importLoading ? <Loader2 size={12} className="animate-spin"/> : <><Upload size={12} /> Importar Dados</>}
                       </button>
                   </div>
                   <button onClick={handleSheetsLogout} className="text-[9px] font-bold text-rose-400 underline w-full text-center">Desconectar Conta</button>
               </div>
            ) : (
              <button onClick={handleSheetsLogin} disabled={!!loading} className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'sheets' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}>
                {loading === 'sheets' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* GOOGLE ADS */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleAdsToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><GoogleIcon size={24} /></div>
              {googleAdsToken ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Ads</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4">Métricas de campanhas.</p>
            {googleAdsToken ? (
               <div className="mt-auto"><button onClick={handleGoogleLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><LogOut size={12} /> Desconectar</button></div>
            ) : (
              <button onClick={handleGoogleLogin} disabled={!!loading} className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'google-ads' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}>
                {loading === 'google-ads' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default Integration;
