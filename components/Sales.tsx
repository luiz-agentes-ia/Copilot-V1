
import React, { useState, useMemo } from 'react';
import { 
  MessageCircle, Clock, CheckCircle2, Search, Send, User, Users, Flame, 
  ArrowUpDown, AlertCircle, HandCoins, Receipt, DollarSign, ArrowUpRight, 
  Sparkles, Loader2, Network, Activity, Timer, ArrowRight, ArrowDownRight,
  Calendar, Stethoscope, UserX, Target, Zap, ChevronDown
} from 'lucide-react';
import { analyzeLeadConversation } from '../services/geminiService';
import { useApp } from '../App';
import { Lead } from '../types';

const Sales: React.FC = () => {
  const { dateFilter, setDateFilter, metrics, leads, addLead, updateLead, addFinancialEntry, user } = useApp();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'stats'>('stats');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');

  // Seleciona o primeiro lead automaticamente se houver e nenhum estiver selecionado
  useMemo(() => {
     if (leads.length > 0 && !activeLead) setActiveLead(leads[0]);
  }, [leads]);

  // Mapear métricas globais para a visualização de Vendas
  const stats = useMemo(() => {
    // Calculos adicionais específicos para esta tela
    const leadsRespondidosPct = (metrics.vendas.conversas / (metrics.marketing.leads || 1)) * 100;
    const taxaCDCPct = (metrics.vendas.agendamentos / (metrics.marketing.leads || 1)) * 100;
    const noShowPct = (1 - (metrics.vendas.comparecimento / (metrics.vendas.agendamentos || 1))) * 100;
    const leadsEmFollowUp = Math.round(metrics.marketing.leads * 0.46);
    
    // Simulação de Follow-up (pode ser refinado com dados reais futuros)
    const followUpIniciados = Math.round(leadsEmFollowUp * 0.82);
    const followUpConvertidos = Math.round(followUpIniciados * 0.45);
    const taxaSucessoFollowUp = (followUpConvertidos / (followUpIniciados || 1)) * 100;

    return {
      leadsTotal: metrics.marketing.leads,
      tempoResposta: '12 min',
      leadsRespondidosPct,
      conversaoConsultaNum: metrics.vendas.agendamentos,
      noShowPct,
      consultasFeitas: metrics.vendas.comparecimento,
      taxaCDCPct,
      leadsEmFollowUp,
      vendasTotal: metrics.vendas.vendas,
      custoPorVenda: metrics.vendas.cpv,
      faturamentoTotal: metrics.financeiro.receitaBruta, // Alinhado com financeiro
      followUp: {
        iniciados: followUpIniciados,
        sucessoPct: taxaSucessoFollowUp,
        tempoMedioConversao: '3.8 Dias',
        estagios: {
          reativacao: Math.round(followUpIniciados * 0.5),
          negociacao: Math.round(followUpIniciados * 0.3),
          fechamento: Math.round(followUpIniciados * 0.2)
        }
      }
    };
  }, [metrics]);

  const handleAnalyzeLead = async () => {
    if (!activeLead) return;
    setIsAnalyzing(true);
    const result = await analyzeLeadConversation(activeLead.name, activeLead.history || 'Sem histórico');
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if(newLeadName && newLeadPhone) {
        await addLead({
            id: '', // Supabase gera
            name: newLeadName,
            phone: newLeadPhone,
            status: 'Novo',
            temperature: 'Cold',
            lastMessage: 'Iniciou contato pelo site',
            potentialValue: user?.ticketValue || 450
        });
        setNewLeadName('');
        setNewLeadPhone('');
    }
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!activeLead) return;
    const newStatus = e.target.value as any;
    
    // Atualiza o lead
    await updateLead({ ...activeLead, status: newStatus });
    
    // Se mudou para VENDA, oferece criar a transação financeira
    if (newStatus === 'Venda') {
       const confirmFinance = window.confirm(`Parabéns pela venda para ${activeLead.name}! 🚀\n\nDeseja lançar automaticamente uma Receita de R$ ${user?.ticketValue} no Financeiro?`);
       if (confirmFinance) {
          await addFinancialEntry({
             id: crypto.randomUUID(),
             type: 'receivable',
             category: 'Consulta Particular',
             name: `Consulta - ${activeLead.name}`,
             unitValue: user?.ticketValue || 450,
             total: user?.ticketValue || 450,
             status: 'efetuada',
             date: new Date().toISOString().split('T')[0],
             discount: 0,
             addition: 0
          });
          alert('Receita lançada com sucesso! O Dashboard Financeiro foi atualizado.');
       }
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-navy tracking-tight">CRM & Inteligência de Vendas</h2>
          <div className="flex items-center gap-2">
            <p className="text-slate-500 text-sm font-light">Gestão de Leads e Conversão.</p>
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> LIVE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
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
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button onClick={() => setActiveTab('stats')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${activeTab === 'stats' ? 'bg-navy text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Métricas</button>
            <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${activeTab === 'chat' ? 'bg-navy text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Leads (Chat)</button>
          </div>
        </div>
      </header>

      {activeTab === 'chat' ? (
        <div className="flex-1 flex gap-6 min-h-0 animate-in fade-in duration-300 overflow-hidden pb-10">
          <div className="w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Pesquisar..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-medium text-navy placeholder:text-slate-400" />
              </div>
              <form onSubmit={handleAddLead} className="flex gap-2">
                 <input value={newLeadName} onChange={e => setNewLeadName(e.target.value)} placeholder="Nome" className="flex-1 px-2 py-1 text-xs border rounded-lg text-navy placeholder:text-slate-400" required />
                 <input value={newLeadPhone} onChange={e => setNewLeadPhone(e.target.value)} placeholder="Tel" className="w-20 px-2 py-1 text-xs border rounded-lg text-navy placeholder:text-slate-400" required />
                 <button type="submit" className="bg-navy text-white px-2 rounded-lg text-xs">+</button>
              </form>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {leads.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Nenhum lead encontrado. Adicione um acima.</div>
              ) : leads.map((lead) => (
                <button key={lead.id} onClick={() => setActiveLead(lead)} className={`w-full p-4 flex gap-3 border-b border-slate-50 transition-all text-left hover:bg-slate-50/80 ${activeLead?.id === lead.id ? 'bg-slate-50 border-l-4 border-l-navy' : 'border-l-4 border-l-transparent'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activeLead?.id === lead.id ? 'bg-navy text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {lead.temperature === 'Hot' ? <Flame size={20} className="text-orange-500" /> : <User size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="text-xs font-semibold text-navy truncate">{lead.name}</h4>
                      <span className="text-[9px] text-slate-400 font-medium">{lead.lastInteraction}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mb-1.5 font-light">{lead.lastMessage}</p>
                    <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${lead.temperature === 'Hot' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{lead.temperature}</span>
                       <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">R$ {lead.potentialValue}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
            {activeLead ? (
            <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center text-white shrink-0"><User size={20} /></div>
                    <div>
                        <h3 className="font-semibold text-navy text-sm leading-tight">{activeLead.name}</h3>
                        <div className="relative inline-block mt-1">
                            <select 
                                value={activeLead.status} 
                                onChange={handleStatusChange}
                                className="appearance-none bg-emerald-50 text-emerald-600 font-bold text-[9px] uppercase tracking-widest pl-2 pr-6 py-0.5 rounded cursor-pointer hover:bg-emerald-100 transition-colors focus:outline-none"
                            >
                                <option value="Novo">Novo Lead</option>
                                <option value="Conversa">Em Conversa</option>
                                <option value="Agendado">Agendado</option>
                                <option value="Venda">Venda Fechada ($)</option>
                                <option value="Perdido">Perdido</option>
                            </select>
                            <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
                        </div>
                    </div>
                </div>
                <button onClick={handleAnalyzeLead} disabled={isAnalyzing} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                    {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Raio-X da IA
                </button>
                </div>
                <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
                    {aiAnalysis ? (
                        <div className="mb-4 bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-900 leading-relaxed whitespace-pre-line">
                            <strong>Análise IA:</strong><br/>{aiAnalysis}
                        </div>
                    ) : null}
                    <div className="max-w-[70%] bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                        <p className="text-sm text-slate-700 leading-relaxed font-light">{activeLead.lastMessage || 'Nenhuma mensagem.'}</p>
                    </div>
                </div>
                <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                <input type="text" placeholder="Escreva sua mensagem..." className="flex-1 pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none text-navy placeholder:text-slate-400" />
                <button className="p-3 bg-navy text-white rounded-xl shadow-lg hover:scale-105 transition-all"><Send size={20} /></button>
                </div>
            </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Selecione um lead para ver a conversa</div>
            )}
          </div>
        </div>
      ) : (
        /* ABA DE MÉTRICAS COMPLETA */
        <div className="space-y-8 overflow-y-auto pr-2 pb-20 animate-in fade-in duration-300 custom-scrollbar">
          
          {/* GRADE DE 9 KPIs PRINCIPAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-blue-400 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Leads (Volume Total)</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.leadsTotal}</p><p className="text-[9px] text-slate-400 mt-2 font-medium uppercase italic tracking-wider">Demanda Gerada</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-400 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><Clock size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Tempo de Resposta</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.tempoResposta}</p><p className="text-[9px] text-emerald-500 mt-2 font-medium uppercase italic tracking-wider">Agilidade de Venda</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-400 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg"><MessageCircle size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Leads Respondidos (%)</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.leadsRespondidosPct.toFixed(1)}%</p><p className="text-[9px] text-emerald-500 mt-2 font-medium uppercase italic tracking-wider">Engajamento Inicial</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-blue-500 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Target size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Conversão para Consulta</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.conversaoConsultaNum}</p><p className="text-[9px] text-slate-400 mt-2 font-medium uppercase italic tracking-wider">Agendamento Efetivo</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-500 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><ArrowUpDown size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Taxa de CDC (%)</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.taxaCDCPct.toFixed(1)}%</p><p className="text-[9px] text-indigo-600 mt-2 font-medium uppercase italic tracking-wider">Leads x Agendamentos</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-amber-400 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertCircle size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Leads em Follow Up</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.leadsEmFollowUp}</p><p className="text-[9px] text-amber-600 mt-2 font-medium uppercase italic tracking-wider">Oportunidades no Limbo</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg"><CheckCircle2 size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Vendas de Tratamento</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">{stats.vendasTotal}</p><p className="text-[9px] text-emerald-500 mt-2 font-medium uppercase italic tracking-wider">Contratos Fechados</p></div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-rose-400 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><HandCoins size={18} /></div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Custo por Venda (CPV)</span>
              </div>
              <div><p className="text-2xl font-bold text-navy tracking-tight">R$ {stats.custoPorVenda.toFixed(2)}</p><p className="text-[9px] text-rose-500 mt-2 font-medium uppercase italic tracking-wider">CAC Final</p></div>
            </div>

            <div className="bg-navy p-6 rounded-2xl text-white shadow-xl relative overflow-hidden ring-1 ring-white/10">
              <Receipt size={60} className="absolute -right-4 -bottom-4 text-white/5" />
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className="p-2 bg-white/10 text-white rounded-lg"><DollarSign size={18} /></div>
                <span className="text-[9px] font-medium text-blue-300 uppercase tracking-widest">Faturamento Total</span>
              </div>
              <div className="relative z-10">
                <p className="text-2xl font-bold tracking-tight leading-none">R$ {stats.faturamentoTotal.toLocaleString('pt-BR')}</p>
                <p className="text-[9px] text-emerald-400 mt-2 font-bold uppercase tracking-tight">Resultado Bruto via Vendas</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
