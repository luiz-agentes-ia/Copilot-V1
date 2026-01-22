
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  CalendarCheck, 
  UserCheck, 
  UserX, 
  Stethoscope, 
  DollarSign, 
  CreditCard, 
  Briefcase,
  AlertTriangle,
  Zap,
  Megaphone,
  Target,
  HandCoins,
  Calendar,
  Users
} from 'lucide-react';
import { generateAudioReport, playPCM } from '../services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';
import { useApp } from '../App';

const Dashboard: React.FC = () => {
  const { dateFilter, setDateFilter, metrics } = useApp();
  const [insight, setInsight] = useState<string>('Analisando sua clínica...');
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  // Verifica se há dados reais para evitar mostrar gráficos vazios com "ruído"
  const hasData = metrics.financeiro.receitaBruta > 0 || metrics.financeiro.gastosTotais > 0;

  const funnelData = [
    { name: 'Leads', value: metrics.marketing.leads, fill: '#0f172a' },
    { name: 'Agendados', value: metrics.vendas.agendamentos, fill: '#334155' },
    { name: 'Compareceram', value: metrics.vendas.comparecimento, fill: '#475569' },
    { name: 'Convertidos', value: metrics.vendas.vendas, fill: '#10b981' },
  ];

  useEffect(() => {
    const loadInsight = async () => {
      if (hasData) {
          setInsight(`No período de ${dateFilter.label}, seu ROI de marketing foi de ${metrics.financeiro.roi.toFixed(0)}%. Focar em recuperar os ${metrics.vendas.agendamentos - metrics.vendas.comparecimento} no-shows pode gerar R$ ${((metrics.vendas.agendamentos - metrics.vendas.comparecimento) * metrics.financeiro.ticketMedio).toLocaleString()} extras.`);
      } else {
          setInsight("Ainda não há dados suficientes neste período para gerar uma análise. Adicione transações financeiras ou leads para começar.");
      }
    };
    loadInsight();
  }, [metrics, dateFilter.label, hasData]);

  const handlePlayAudio = async () => {
    if (!hasData) return;
    setLoadingAudio(true);
    const audioData = await generateAudioReport(insight);
    if (audioData) {
      await playPCM(audioData);
    }
    setLoadingAudio(false);
  };

  const kpis = [
    { label: 'INVESTIMENTO (MARKETING)', value: `R$ ${metrics.marketing.investimento.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, trend: '+0%', icon: <Megaphone className="text-blue-500" size={18} /> },
    { label: 'LEADS NO PERÍODO', value: metrics.marketing.leads.toString(), trend: '+0%', icon: <Users className="text-indigo-500" size={18} /> },
    { label: 'CPL (CUSTO POR LEAD)', value: `R$ ${metrics.marketing.cpl.toFixed(2)}`, trend: 'R$ 0,00', icon: <Target className="text-blue-400" size={18} /> },
    { label: 'CONSULTAS MARCADAS', value: metrics.vendas.agendamentos.toString(), trend: '+0%', icon: <CalendarCheck className="text-blue-600" size={18} /> },
    { label: 'COMPARECIMENTO', value: metrics.vendas.agendamentos > 0 ? `${Math.round((metrics.vendas.comparecimento / metrics.vendas.agendamentos) * 100)}%` : '0%', trend: '0%', icon: <UserCheck className="text-emerald-500" size={18} /> },
    { label: 'CAC (CUSTO AQUIS. CONSULTA)', value: `R$ ${metrics.vendas.cac.toFixed(2)}`, trend: 'Meta: R$ 0', icon: <Zap className="text-amber-500" size={18} /> },
    { label: 'FALTAS (NO-SHOW)', value: metrics.vendas.agendamentos > 0 ? `${Math.round(((metrics.vendas.agendamentos - metrics.vendas.comparecimento) / metrics.vendas.agendamentos) * 100)}%` : '0%', trend: '0%', icon: <UserX className="text-rose-500" size={18} />, trendNegative: true },
    { label: 'VENDAS DE TRATAMENTO', value: metrics.vendas.vendas.toString(), trend: '+0%', icon: <Stethoscope className="text-purple-500" size={18} /> },
    { label: 'RECEITA BRUTA', value: `R$ ${metrics.financeiro.receitaBruta.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, trend: '+0%', icon: <DollarSign className="text-emerald-600" size={18} /> },
    { label: 'CPV (CUSTO POR VENDA)', value: `R$ ${metrics.vendas.cpv.toFixed(2)}`, trend: 'Eficiente', icon: <HandCoins className="text-indigo-600" size={18} /> },
    { label: 'GASTOS TOTAIS', value: `R$ ${metrics.financeiro.gastosTotais.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, trend: '+0%', icon: <CreditCard className="text-rose-500" size={18} /> },
    { label: 'LUCRO LÍQUIDO (EST.)', value: `R$ ${metrics.financeiro.lucroLiquido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, trend: '+0%', icon: <Briefcase className="text-navy" size={18} />, isMain: true },
  ];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-navy tracking-tight">Resumo Executivo</h2>
          <p className="text-slate-500 text-sm font-light">Dados consolidados de {dateFilter.start} até {dateFilter.end}</p>
        </div>
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          {['Hoje', '7 dias', '30 dias', 'Este Ano'].map((t) => (
            <button 
              key={t} 
              onClick={() => setDateFilter(t)}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${t === dateFilter.label ? 'bg-navy text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* INSIGHT IA CARD */}
      <div className="bg-navy rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Zap size={100} /></div>
        <div className="relative z-10 flex items-center gap-6">
          <button 
            onClick={handlePlayAudio}
            disabled={!hasData || loadingAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform shrink-0 shadow-lg ${!hasData ? 'bg-white/20 text-white/50 cursor-not-allowed' : 'bg-white text-navy hover:scale-105'}`}
          >
            {loadingAudio ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy"></div> : <Play fill="currentColor" size={18} />}
          </button>
          <div className="flex-1">
            <h3 className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Zap size={12} /> RELATÓRIO DO COPILOT AI ({dateFilter.label.toUpperCase()})
            </h3>
            <p className="text-lg leading-relaxed font-light italic opacity-90">"{insight}"</p>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md relative ${kpi.isMain ? 'ring-1 ring-blue-500 border-blue-200' : ''}`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{kpi.label}</span>
              <div className="p-2 bg-slate-50 rounded-lg">{kpi.icon}</div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-navy tracking-tight">{kpi.value}</span>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${kpi.trendNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {kpi.trend} VS ANTERIOR
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FUNNEL & URGENT ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-[10px] font-bold text-navy uppercase tracking-widest mb-8">Funil de Atendimento no Período</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 500, fill: '#94a3b8'}} dy={10} />
                <YAxis hide />
                <Tooltip cursor={{fill: '#f8fafc', radius: 4}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={35}>
                  {funnelData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <h3 className="text-[10px] font-bold text-navy uppercase tracking-widest mb-6">Ações Urgentes</h3>
          {metrics.marketing.leads > 0 || metrics.vendas.agendamentos > 0 ? (
            <div className="space-y-4">
                {metrics.marketing.leads > 0 && (
                <div className="p-4 bg-amber-50 border-l-2 border-amber-400 rounded-r-xl">
                    <h4 className="text-[10px] font-bold text-amber-900 uppercase flex items-center gap-2"><AlertTriangle size={12} /> Perda por Follow-up</h4>
                    <p className="text-xs text-amber-800 mt-1 font-light">{Math.round(metrics.marketing.leads * 0.2)} pacientes sem resposta recente.</p>
                </div>
                )}
                <div className="p-4 bg-blue-50 border-l-2 border-blue-400 rounded-r-xl">
                    <h4 className="text-[10px] font-bold text-blue-900 uppercase flex items-center gap-2"><Calendar size={12} /> Recalibração de Agenda</h4>
                    <p className="text-xs text-blue-800 mt-1 font-light">Verifique horários ociosos na próxima semana.</p>
                </div>
            </div>
          ) : (
             <div className="flex-1 flex items-center justify-center text-center">
                <p className="text-xs text-slate-400 italic">Sem ações urgentes no momento.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
