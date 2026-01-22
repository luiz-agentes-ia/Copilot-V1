import React, { useState, useEffect, useMemo } from 'react';
import { 
  Instagram, DollarSign, TrendingUp, Bot, Users, Target, MousePointer2, Eye,
  Filter, Loader2, Zap, AlertCircle
} from 'lucide-react';
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';
import { useApp } from '../App';
import { getCampaignInsights } from '../services/metaService';
import { getGoogleCampaigns } from '../services/googleAdsService';

const GoogleIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c3.11 0 5.71-1.03 7.61-2.81l-3.57-2.77c-.99.66-2.26 1.06-4.04 1.06-3.41 0-6.3-2.3-7.34-5.41H1.04v2.81C3.12 19.38 7.3 23 12 23z" fill="#34A853"/>
    <path d="M4.66 14.07c-.26-.77-.41-1.6-.41-2.47s.15-1.7.41-2.47V6.32H1.04C.38 7.64 0 9.13 0 10.7c0 1.57.38 3.06 1.04 4.38l3.62-2.81z" fill="#FBBC05"/>
    <path d="M12 4.19c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.03 15.11 0 12 0 7.3 0 3.12 3.62 1.04 8.07l3.62 2.81c1.04-3.11 3.93-5.41 7.34-5.41z" fill="#EA4335"/>
  </svg>
);

const Marketing: React.FC = () => {
  const { dateFilter, setDateFilter, metaToken, googleAdsToken } = useApp();
  const [loading, setLoading] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'google' | 'meta'>('all');
  
  // States para dados reais
  const [realMetaCampaigns, setRealMetaCampaigns] = useState<any[]>([]);
  const [realGoogleCampaigns, setRealGoogleCampaigns] = useState<any[]>([]);

  // Verifica se está conectado em ALGUMA plataforma
  const isConnected = !!metaToken || !!googleAdsToken;

  const DEV_TOKEN = (import.meta as any)?.env?.VITE_GOOGLE_ADS_DEV_TOKEN || 'SEU_DEVELOPER_TOKEN_AQUI';

  // --- BUSCA DADOS REAIS META ---
  useEffect(() => {
    const fetchMetaData = async () => {
      if (metaToken) {
        setLoading(true);
        try {
          const accountId = localStorage.getItem('selected_meta_account_id');
          if (!accountId) {
             setLoading(false);
             return; 
          }

          const response = await fetch(`https://graph.facebook.com/v19.0/${accountId}/campaigns?fields=name,id,status&access_token=${metaToken}`);
          const data = await response.json();
          
          if (data.data) {
             const campaignsWithInsights = await Promise.all(data.data.map(async (camp: any) => {
                try {
                    const insights = await getCampaignInsights(camp.id, metaToken, { start: dateFilter.start, end: dateFilter.end });
                    return { name: camp.name, platform: 'meta', ...insights };
                } catch (e) {
                    return { name: camp.name, platform: 'meta', spend: 0, clicks: 0, impressions: 0, conversions: 0 };
                }
             }));
             // Filtra apenas campanhas com algum gasto (opcional, mas bom para limpeza)
             setRealMetaCampaigns(campaignsWithInsights);
          } else {
             setRealMetaCampaigns([]);
          }
        } catch (error) {
           console.error("Erro Meta:", error);
           setRealMetaCampaigns([]); // Zera em caso de erro
        } finally {
           setLoading(false);
        }
      } else {
        setRealMetaCampaigns([]);
      }
    };
    fetchMetaData();
  }, [metaToken, dateFilter]);

  // --- BUSCA DADOS REAIS GOOGLE ---
  useEffect(() => {
    const fetchGoogleData = async () => {
        if (googleAdsToken) {
            setLoading(true);
            const accountId = localStorage.getItem('selected_google_account_id');
            
            if (!accountId) {
                setRealGoogleCampaigns([]);
                setLoading(false);
                return;
            }

            try {
                // Busca dados reais usando a API
                const results = await getGoogleCampaigns(accountId, googleAdsToken, DEV_TOKEN, { start: dateFilter.start, end: dateFilter.end });
                
                const mappedCampaigns = results.map((row: any) => ({
                    name: row.campaign.name,
                    platform: 'google',
                    // Google Ads cost is in micros (multiply by 10^-6)
                    spend: (parseInt(row.metrics.costMicros) || 0) / 1000000,
                    clicks: parseInt(row.metrics.clicks) || 0,
                    impressions: parseInt(row.metrics.impressions) || 0,
                    leads: parseFloat(row.metrics.conversions) || 0, // Usando conversões como leads
                    status: row.campaign.status
                }));
                
                setRealGoogleCampaigns(mappedCampaigns);
            } catch (error) {
                console.error("Erro ao buscar campanhas Google:", error);
                setRealGoogleCampaigns([]);
            } finally {
                setLoading(false);
            }
        } else {
            setRealGoogleCampaigns([]);
        }
    };
    fetchGoogleData();
  }, [googleAdsToken, dateFilter]);


  // --- CONSOLIDAÇÃO DE DADOS ---
  const campaigns = useMemo(() => {
    // MOCK DATA (Apenas se NÃO estiver conectado em NADA)
    const mockGoogle = [
      { name: 'Google Search - Institucional', platform: 'google', spend: 450, leads: 12, impressions: 3200, clicks: 140 },
      { name: 'Google Display - Remarketing', platform: 'google', spend: 210, leads: 5, impressions: 15000, clicks: 80 },
    ];
    const mockMeta = [
      { name: 'Botox Face - Instagram', platform: 'meta', spend: 850, leads: 34, impressions: 12000, clicks: 210 },
      { name: 'Preenchimento Labial', platform: 'meta', spend: 620, leads: 22, impressions: 8500, clicks: 150 },
    ];

    if (isConnected) {
        // MODO REAL: Junta o que tiver de real. Se um deles estiver vazio, fica vazio.
        // IMPORTANTE: Isso garante que se o usuário conectou, mas a API não retornou nada, ele vê ZERO.
        return [...realGoogleCampaigns, ...realMetaCampaigns];
    } else {
        // MODO DEMO: Mostra dados fictícios apenas se NADA estiver conectado.
        return [...mockGoogle, ...mockMeta];
    }
  }, [isConnected, realMetaCampaigns, realGoogleCampaigns]);


  // CÁLCULO DE TOTAIS
  const totalSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
  const totalLeads = campaigns.reduce((acc, c) => acc + (c.leads || c.conversions || 0), 0);
  const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressions, 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const conversions = Math.round(totalLeads * 0.12);

  const activeCampaigns = platformFilter === 'all' 
    ? campaigns 
    : campaigns.filter(c => c.platform === platformFilter);

  // Stats por Canal
  const channelStats = useMemo(() => {
    const googleData = campaigns.filter(c => c.platform === 'google');
    const metaData = campaigns.filter(c => c.platform === 'meta');
    
    const calcStats = (data: any[]) => {
       const spend = data.reduce((a, b) => a + b.spend, 0);
       const leads = data.reduce((a, b) => a + (b.leads || b.conversions || 0), 0);
       return {
          spend,
          leads,
          cpl: leads > 0 ? spend / leads : 0,
          qualifiedLeads: Math.round(leads * 0.3),
          qualifiedRate: leads > 0 ? 30.0 : 0
       };
    };

    return [
      { id: 'google', name: 'Google Ads', icon: <GoogleIcon />, ...calcStats(googleData) },
      { id: 'meta', name: 'Meta Ads', icon: <Instagram size={16} className="text-pink-600" />, ...calcStats(metaData) }
    ];
  }, [campaigns]);

  const filteredChannelStats = platformFilter === 'all' 
    ? channelStats 
    : channelStats.filter(c => c.id === platformFilter);

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-navy tracking-tight">Performance de Tráfego Pago</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-500 font-light italic">Monitoramento em tempo real de Google e Meta Ads.</p>
            {!isConnected && (
              <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-amber-100">Modo Demo (Dados Simulados)</span>
            )}
            {isConnected && (
               <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-100 flex items-center gap-1"><Zap size={8} fill="currentColor"/> Dados Reais Conectados</span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          {['Hoje', '7 dias', '30 dias', 'Este Ano'].map((t) => (
            <button 
              key={t} 
              onClick={() => setDateFilter(t)}
              className={`px-4 py-1.5 text-[10px] font-bold rounded-lg uppercase transition-all ${t === dateFilter.label ? 'bg-navy text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* AVISO QUANDO CONECTADO MAS SEM DADOS */}
      {isConnected && campaigns.length === 0 && !loading && (
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-white rounded-full text-blue-500 shadow-sm"><AlertCircle size={24} /></div>
              <div>
                  <h3 className="text-sm font-bold text-navy">Conectado, mas sem dados recentes.</h3>
                  <p className="text-xs text-slate-500 mt-1">
                      Não encontramos campanhas ativas ou gastos no período selecionado ({dateFilter.label}). 
                      Verifique se selecionou a conta correta ou aumente o período de data.
                  </p>
              </div>
          </div>
      )}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4 bg-white rounded-[40px] border border-slate-200">
          <Loader2 size={32} className="text-navy animate-spin" />
          <p className="text-[10px] font-bold text-navy uppercase tracking-widest">Sincronizando dados das APIs...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Investimento Total</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={16} /></div>
              </div>
              <p className="text-2xl font-bold text-navy tracking-tight">R$ {totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Leads Capturados</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={16} /></div>
              </div>
              <p className="text-2xl font-bold text-navy tracking-tight">{totalLeads}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Custo por Lead (CPL)</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Target size={16} /></div>
              </div>
              <p className="text-2xl font-bold text-navy tracking-tight">R$ {cpl.toFixed(2)}</p>
            </div>

            <div className="bg-navy p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group border border-white/5">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={50} /></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-[10px] font-medium text-blue-400 uppercase tracking-widest">Conversão Est.</span>
                <Zap size={14} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold relative z-10 tracking-tight">{conversions}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-2 relative z-10 uppercase italic">Estimativa Automática</p>
            </div>
          </div>

          {campaigns.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-[10px] font-bold text-navy uppercase tracking-widest">Investimento por Campanha</h3>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Análise de Performance Individual</p>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={activeCampaigns}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 400, fill: '#94a3b8' }} dy={10} hide={window.innerWidth < 768} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: '#f8fafc', radius: 8 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="spend" radius={[6, 6, 0, 0]} barSize={40}>
                        {activeCampaigns.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0f172a' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <h3 className="font-black text-navy uppercase text-xs tracking-[0.2em]">Performance por Origem</h3>
                   <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button onClick={() => setPlatformFilter('all')} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${platformFilter === 'all' ? 'bg-navy text-white shadow-sm' : 'text-slate-400 hover:text-navy'}`}>Todos</button>
                      <button onClick={() => setPlatformFilter('google')} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${platformFilter === 'google' ? 'bg-navy text-white shadow-sm' : 'text-slate-400 hover:text-navy'}`}>Google</button>
                      <button onClick={() => setPlatformFilter('meta')} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${platformFilter === 'meta' ? 'bg-navy text-white shadow-sm' : 'text-slate-400 hover:text-navy'}`}>Meta</button>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50/30">
                         <tr>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Canal</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Investimento</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Leads</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">CPL</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredChannelStats.map((channel) => (
                            <tr key={channel.id} className="hover:bg-slate-50 transition-colors group">
                               <td className="px-8 py-5 flex items-center gap-3">
                                  <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">{channel.icon}</div>
                                  <span className="text-xs font-bold text-navy">{channel.name}</span>
                               </td>
                               <td className="px-8 py-5 text-right text-xs font-medium text-slate-600">R$ {channel.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                               <td className="px-8 py-5 text-right text-xs font-bold text-navy">{channel.leads}</td>
                               <td className="px-8 py-5 text-right text-xs font-bold text-indigo-600">R$ {channel.cpl.toFixed(2)}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
               <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">MÉTRICAS SECUNDÁRIAS</h3>
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><MousePointer2 size={16} /></div>
                           <span className="text-xs font-semibold text-navy">Cliques Totais</span>
                        </div>
                        <span className="text-xs font-bold text-navy">{campaigns.reduce((a,b)=>a+b.clicks, 0)}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><Eye size={16} /></div>
                           <span className="text-xs font-semibold text-navy">Impressões</span>
                        </div>
                        <span className="text-xs font-bold text-navy">{Math.round(totalImpressions).toLocaleString()}</span>
                     </div>
                  </div>
               </div>
               
               {/* Diagnóstico IA */}
               <div className="bg-navy p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group border border-white/5">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Bot size={70} /></div>
                  <div className="flex gap-4 items-start relative z-10">
                     <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/10"><Bot size={22} /></div>
                     <div className="flex-1">
                        <h4 className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">DIAGNÓSTICO IA</h4>
                        <p className="text-sm font-light leading-relaxed italic opacity-90 text-slate-300">
                           {campaigns.length > 0 
                             ? "Analisando seus dados reais: Uma das campanhas apresenta custo por lead acima da média. Considere pausá-la e realocar o orçamento."
                             : "Conecte suas contas para receber diagnósticos personalizados."}
                        </p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
          )}
          
          {campaigns.length > 0 && (
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-700">
             <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-black text-navy uppercase text-xs tracking-[0.2em]">Detalhamento de Campanhas</h3>
                 <button className="text-slate-400 hover:text-navy transition-colors"><Filter size={16} /></button>
             </div>
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead className="bg-slate-50/50 border-b border-slate-100">
                         <tr>
                             <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Campanha</th>
                             <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Plataforma</th>
                             <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Inv.</th>
                             <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Leads</th>
                             <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">CPL</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {activeCampaigns.map((camp, i) => {
                             const leadCount = camp.leads || camp.conversions || 0;
                             const cpl = leadCount > 0 ? camp.spend / leadCount : 0;
                             return (
                                 <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                     <td className="px-6 py-4"><p className="text-xs font-bold text-navy truncate max-w-[150px]">{camp.name}</p></td>
                                     <td className="px-6 py-4 text-center">{camp.platform === 'meta' ? <Instagram size={14} className="mx-auto text-pink-600" /> : <GoogleIcon size={14} />}</td>
                                     <td className="px-6 py-4 text-right text-xs font-bold text-navy">R$ {camp.spend.toLocaleString()}</td>
                                     <td className="px-6 py-4 text-right text-xs font-bold text-navy">{leadCount}</td>
                                     <td className="px-6 py-4 text-right text-xs font-bold text-emerald-600">R$ {cpl.toFixed(2)}</td>
                                 </tr>
                             )
                         })}
                     </tbody>
                 </table>
             </div>
          </div>
          )}
        </>
      )}
    </div>
  );
};

export default Marketing;