
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
  FileSpreadsheet,
  Activity,
  AlertCircle,
  Search,
  ArrowRight,
  DownloadCloud,
  ChevronRight,
  Table,
  FileDown
} from 'lucide-react';
import { useApp } from '../App';
import { signInWithGoogleAds, getAccessibleCustomers } from '../services/googleAdsService';
import { signInWithGoogleCalendar } from '../services/googleCalendarService';
import { signInWithGoogleSheets, listSpreadsheets, getSpreadsheetDetails, getSheetData } from '../services/googleSheetsService';
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

interface ExtendedAdAccount extends GoogleAdAccount {
    isManager?: boolean;
}

const Integration: React.FC = () => {
  const { integrations, googleCalendarToken, googleAdsToken, setGoogleAdsToken, setGoogleCalendarToken, googleSheetsToken, setGoogleSheetsToken, addLead, user } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<'google' | 'supabase'>('google');
  
  const currentOrigin = window.location.origin; 
  const currentRedirectUrl = (window.location.origin + window.location.pathname).replace(/\/$/, "");
  const supabaseProjectUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://seu-projeto.supabase.co';
  const supabaseCallbackUrl = `${supabaseProjectUrl}/auth/v1/callback`;

  // States Google Ads
  const [googleAccounts, setGoogleAccounts] = useState<ExtendedAdAccount[]>([]);
  const [selectedGoogleAccountId, setSelectedGoogleAccountId] = useState<string>(localStorage.getItem('selected_google_account_id') || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // States Google Sheets Import
  const [isImporting, setIsImporting] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>('');
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');

  // --- EFEITOS E HANDLERS ---
  useEffect(() => {
    if (googleAdsToken && googleAccounts.length === 0) {
      setLoading('google-ads');
      setErrorMsg(null);
      
      setTimeout(() => {
        getAccessibleCustomers(googleAdsToken)
          .then(accounts => {
            setGoogleAccounts(accounts);
            if (accounts.length > 0 && !selectedGoogleAccountId) {
                const firstStandardAccount = accounts.find(acc => !(acc as any).isManager);
                if (firstStandardAccount) {
                    handleSelectGoogleAccount(firstStandardAccount.id);
                } else {
                    handleSelectGoogleAccount(accounts[0].id);
                }
            }
            setLoading(null);
          })
          .catch(err => {
            console.error("Erro Google:", err);
            setErrorMsg(err.message || "Erro desconhecido ao conectar.");
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
    const cleanId = id.replace(/[^0-9]/g, '');
    setSelectedGoogleAccountId(cleanId);
    localStorage.setItem('selected_google_account_id', cleanId);
    setShowManualInput(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.length < 10) {
        alert("O ID da conta deve ter pelo menos 10 dígitos (ex: 123-456-7890)");
        return;
    }
    handleSelectGoogleAccount(manualId);
    setGoogleAccounts(prev => {
        if (prev.find(p => p.id === manualId.replace(/[^0-9]/g, ''))) return prev;
        return [...prev, {
            id: manualId.replace(/[^0-9]/g, ''),
            name: `customers/${manualId}`,
            descriptiveName: `Conta Manual (${manualId})`,
            currencyCode: 'BRL',
            timeZone: 'America/Sao_Paulo'
        }]
    });
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

  // --- SHEETS IMPORT LOGIC ---
  const startImportFlow = async () => {
      if (!googleSheetsToken) return;
      setIsImporting(true);
      setImportStatus('Buscando planilhas...');
      try {
          const files = await listSpreadsheets(googleSheetsToken);
          setSpreadsheets(files);
          setImportStatus('');
      } catch (err) {
          setImportStatus('Erro ao listar arquivos. Tente reconectar.');
          console.error(err);
      }
  };

  const downloadTemplate = () => {
      const csvContent = "data:text/csv;charset=utf-8,Nome,Telefone,Status,Valor\nJoão Silva,11999999999,Novo,100\nMaria Souza,21988888888,Agendado,200";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "modelo_leads_copilot.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleSpreadsheetSelect = async (id: string) => {
      setSelectedSpreadsheet(id);
      setSelectedTab('');
      setSheetTabs([]);
      setImportStatus('Buscando abas...');
      try {
          if (!googleSheetsToken) throw new Error("Token invalido");
          const tabs = await getSpreadsheetDetails(googleSheetsToken, id);
          setSheetTabs(tabs);
          setImportStatus('');
      } catch (err) {
          setImportStatus('Erro ao ler detalhes da planilha.');
      }
  };

  const processImport = async () => {
      if (!googleSheetsToken || !selectedSpreadsheet || !selectedTab) return;
      setImportStatus('Importando dados... (Isso pode levar alguns segundos)');
      
      try {
          const rows = await getSheetData(googleSheetsToken, selectedSpreadsheet, selectedTab);
          
          if (!rows || rows.length < 2) {
              setImportStatus('A planilha parece vazia ou sem cabeçalho.');
              return;
          }

          // Identificar cabeçalhos (Linha 0)
          const headers = rows[0].map((h: string) => h.toLowerCase().trim());
          
          // Mapeamento Flexível
          const nameIndex = headers.findIndex((h: string) => h.includes('nome') || h.includes('cliente') || h.includes('paciente') || h.includes('name'));
          const phoneIndex = headers.findIndex((h: string) => h.includes('tel') || h.includes('cel') || h.includes('phone') || h.includes('whatsapp') || h.includes('contato'));
          const statusIndex = headers.findIndex((h: string) => h.includes('status') || h.includes('fase'));
          const valueIndex = headers.findIndex((h: string) => h.includes('valor') || h.includes('preço') || h.includes('potencial'));

          if (nameIndex === -1 || phoneIndex === -1) {
              setImportStatus('Erro: Cabeçalho inválido. Certifique-se de ter as colunas "Nome" e "Telefone".');
              return;
          }

          let importedCount = 0;

          // Processar linhas (A partir da linha 1)
          for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const name = row[nameIndex];
              const phone = row[phoneIndex];

              if (name && phone) {
                  // Insere no Supabase via addLead (do AppContext)
                  await addLead({
                      id: '', // Gerado pelo addLead
                      name: name,
                      phone: phone.replace(/\D/g, ''), // Limpa telefone
                      status: statusIndex !== -1 ? (row[statusIndex] || 'Novo') : 'Novo',
                      temperature: 'Cold',
                      lastMessage: 'Importado via Planilha',
                      potentialValue: valueIndex !== -1 ? (parseFloat(row[valueIndex]) || user?.ticketValue) : user?.ticketValue,
                      source: 'Google Sheets'
                  });
                  importedCount++;
              }
          }

          setImportStatus(`Sucesso! ${importedCount} leads importados.`);
          setTimeout(() => {
              setIsImporting(false);
              setImportStatus('');
              setSelectedSpreadsheet('');
          }, 3000);

      } catch (err) {
          console.error(err);
          setImportStatus('Erro ao processar importação.');
      }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const renderGoogleAdsCard = () => (
    <div className="mt-4 space-y-3 animate-in fade-in">
      <div className={`p-3 rounded-xl border ${errorMsg ? 'bg-rose-50 border-rose-100' : 'bg-blue-50/50 border-blue-100'}`}>
          <p className={`text-[10px] font-bold uppercase flex items-center gap-1 mb-2 ${errorMsg ? 'text-rose-600' : 'text-blue-600'}`}>
              <Zap size={10} /> {errorMsg ? 'Erro na Conexão' : 'Conexão Estabelecida'}
          </p>
          
          {loading === 'google-ads' ? (
             <div className="flex items-center gap-2 text-xs text-blue-800">
               <Loader2 size={12} className="animate-spin"/> Buscando contas vinculadas...
             </div>
          ) : errorMsg ? (
            <div className="flex items-start gap-2">
               <AlertOctagon size={16} className="text-rose-500 shrink-0 mt-0.5" />
               <div>
                  <p className="text-[10px] font-bold text-rose-700 leading-tight">{errorMsg}</p>
                  <p className="text-[9px] text-rose-500 mt-1 leading-tight">
                    {errorMsg.includes("Developer Token") 
                        ? "O servidor não encontrou o Token de Desenvolvedor no .env" 
                        : "Tente desconectar e conectar novamente."}
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
                    <option key={acc.id} value={acc.id}>
                        {acc.isManager ? '[MCC] ' : ''} {acc.descriptiveName} ({acc.id})
                    </option>
                  ))}
                </select>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
               <div className="flex items-start gap-2 text-amber-600">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold leading-tight">
                     Nenhuma conta encontrada.
                  </p>
               </div>
               {!showManualInput && (
                   <button onClick={() => setShowManualInput(true)} className="w-full py-2 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
                     <Search size={12} /> Inserir ID Manualmente
                   </button>
               )}
            </div>
          )}

          {showManualInput && (
             <form onSubmit={handleManualSubmit} className="mt-3 pt-3 border-t border-blue-100 animate-in fade-in">
                <label className="text-[9px] font-bold text-navy uppercase mb-1 block">ID da Conta Google Ads</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="Ex: 123-456-7890" value={manualId} onChange={(e) => setManualId(e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-200 text-xs text-navy focus:outline-none focus:border-navy" />
                    <button type="submit" className="p-2 bg-navy text-white rounded-lg hover:bg-slate-800 transition-colors"><ArrowRight size={14} /></button>
                </div>
             </form>
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

      {/* DASHBOARD DE STATUS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-500">
        {[
            { id: 'google-ads', label: 'Google Ads', active: !!googleAdsToken, icon: <GoogleIcon size={18} /> },
            { id: 'calendar', label: 'G. Calendar', active: !!googleCalendarToken, icon: <Calendar size={18} /> },
            { id: 'sheets', label: 'G. Sheets', active: !!googleSheetsToken, icon: <FileSpreadsheet size={18} /> },
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

      {/* CARDS DE CONEXÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* GOOGLE ADS */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleAdsToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><GoogleIcon size={24} /></div>
              {googleAdsToken ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Ads</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Conecte sua conta de anúncios para importar métricas.</p>
            
            {googleAdsToken ? renderGoogleAdsCard() : (
              <button onClick={handleGoogleLogin} disabled={!!loading} className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'google-ads' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}>
                {loading === 'google-ads' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* GOOGLE CALENDAR */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleCalendarToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><Calendar className="text-amber-500" /></div>
              {googleCalendarToken ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Calendar</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Sincronize sua agenda para detectar ocupação.</p>
            {googleCalendarToken ? (
               <div className="mt-auto"><button onClick={handleCalendarLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><LogOut size={12} /> Desconectar</button></div>
            ) : (
              <button onClick={handleCalendarLogin} disabled={!!loading} className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'calendar' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}>
                {loading === 'calendar' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>

        {/* GOOGLE SHEETS */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col group transition-all ${googleSheetsToken ? 'border-emerald-100 ring-1 ring-emerald-50' : 'border-slate-200 hover:border-navy'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-navy group-hover:text-white transition-colors"><FileSpreadsheet className="text-emerald-500" /></div>
              {googleSheetsToken ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase border border-emerald-100"><CheckCircle2 size={10} /> Ativo</span> : <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full uppercase border border-slate-100">Inativo</span>}
            </div>
            <h3 className="font-black text-navy text-sm uppercase tracking-widest">Google Sheets</h3>
            <p className="text-[10px] text-slate-400 mt-1 mb-4 h-8">Importe leads diretamente das suas planilhas.</p>
            
            {googleSheetsToken ? (
               <div className="mt-auto space-y-3">
                  {!isImporting ? (
                      <button onClick={startImportFlow} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                          <DownloadCloud size={14} /> Importar Leads
                      </button>
                  ) : (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3 animate-in fade-in">
                          
                          {/* INSTRUÇÕES VISUAIS PARA O FORMATO DA PLANILHA */}
                          <div className="bg-white p-3 rounded-lg border border-emerald-100 mb-2">
                              <p className="text-[9px] font-bold text-navy uppercase mb-2 flex items-center gap-1">
                                  <Table size={12} className="text-emerald-600"/> Modelo Obrigatório
                              </p>
                              <p className="text-[9px] text-slate-500 mb-2 leading-relaxed">
                                  Sua planilha <strong>precisa</strong> ter uma linha de cabeçalho com os nomes exatos abaixo para funcionar:
                              </p>
                              <div className="grid grid-cols-4 gap-1 text-[8px] font-mono text-center">
                                   <div className="bg-slate-100 p-1 rounded border border-slate-200 text-navy font-bold">Nome</div>
                                   <div className="bg-slate-100 p-1 rounded border border-slate-200 text-navy font-bold">Telefone</div>
                                   <div className="bg-slate-50 p-1 rounded border border-slate-100 text-slate-400">Status</div>
                                   <div className="bg-slate-50 p-1 rounded border border-slate-100 text-slate-400">Valor</div>
                              </div>
                              <div className="flex justify-between items-center mt-3">
                                <p className="text-[8px] text-rose-500 font-bold">* Colunas "Nome" e "Telefone" são obrigatórias.</p>
                                <button onClick={downloadTemplate} className="text-[8px] font-bold text-emerald-600 flex items-center gap-1 hover:underline">
                                    <FileDown size={10} /> Baixar Modelo CSV
                                </button>
                              </div>
                          </div>

                          <p className="text-[10px] font-bold text-emerald-800">{importStatus || 'Selecione o arquivo:'}</p>
                          
                          {/* 1. Seleção de Planilha */}
                          {spreadsheets.length > 0 && !selectedSpreadsheet && (
                              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                                  {spreadsheets.map(file => (
                                      <button key={file.id} onClick={() => handleSpreadsheetSelect(file.id)} className="w-full text-left px-2 py-1.5 hover:bg-emerald-100 rounded text-xs text-navy truncate block">
                                          {file.name}
                                      </button>
                                  ))}
                              </div>
                          )}

                          {/* 2. Seleção de Aba */}
                          {selectedSpreadsheet && sheetTabs.length > 0 && !selectedTab && (
                              <div className="space-y-2">
                                  <p className="text-[9px] text-slate-400 uppercase font-bold">Selecione a Aba:</p>
                                  <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                                      {sheetTabs.map(tab => (
                                          <button key={tab} onClick={() => setSelectedTab(tab)} className="w-full text-left px-2 py-1.5 hover:bg-emerald-100 rounded text-xs text-navy truncate block">
                                              {tab}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* 3. Confirmação e Aviso de Formato */}
                          {selectedSpreadsheet && selectedTab && (
                             <div className="space-y-3">
                                <button onClick={processImport} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors">
                                   Processar Importação
                                </button>
                             </div>
                          )}

                          <button onClick={() => { setIsImporting(false); setSelectedSpreadsheet(''); }} className="text-[9px] text-slate-400 hover:text-navy underline w-full text-center">Cancelar</button>
                      </div>
                  )}

                  <button onClick={handleSheetsLogout} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <LogOut size={12} /> Desconectar
                  </button>
               </div>
            ) : (
              <button onClick={handleSheetsLogin} disabled={!!loading} className={`mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${loading === 'sheets' ? 'bg-slate-100 text-slate-400' : 'bg-navy text-white hover:bg-slate-800 shadow-lg shadow-navy/20'}`}>
                {loading === 'sheets' ? <Loader2 size={14} className="animate-spin" /> : 'Conectar Agora'}
              </button>
            )}
        </div>
      </div>
      
      {/* SEÇÃO DE CONFIGURAÇÃO (Abas) */}
      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm mt-10">
         <div className="bg-slate-50/50 border-b border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-navy text-white rounded-lg"><Terminal size={18} /></div>
                <h4 className="text-lg font-bold text-navy">Manual de Configuração (Desenvolvedor)</h4>
            </div>
            <p className="text-sm text-slate-500 mb-6">Siga estes passos apenas se você for o administrador técnico.</p>
            
            <div className="flex gap-2 border-b border-slate-200">
                <button 
                    onClick={() => setActiveGuideTab('google')}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeGuideTab === 'google' ? 'border-navy text-navy bg-white rounded-t-xl' : 'border-transparent text-slate-400 hover:text-navy hover:bg-slate-100/50 rounded-t-xl'}`}
                >
                   <GoogleIcon size={14} /> Google Cloud
                </button>
            </div>
         </div>

         <div className="p-8 min-h-[300px]">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">1. Authorized JavaScript Origins</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono text-navy border border-slate-200 truncate">{currentOrigin}</code>
                                    <button onClick={() => copyToClipboard(currentOrigin, 'origin')} className="p-2 bg-slate-200 rounded-lg text-slate-600 hover:bg-navy hover:text-white transition-colors">{copied === 'origin' ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button>
                                </div>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <label className="text-[10px] font-black text-emerald-700 uppercase block mb-2">2. Authorized Redirect URIs</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono text-emerald-800 border border-emerald-200 truncate font-bold">{supabaseCallbackUrl}</code>
                                    <button onClick={() => copyToClipboard(supabaseCallbackUrl, 'callback')} className="p-2 bg-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors">{copied === 'callback' ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button>
                                </div>
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
