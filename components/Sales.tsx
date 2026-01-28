
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  MessageCircle, Clock, CheckCircle2, Search, Send, User, Users, Flame, 
  ArrowUpDown, AlertCircle, HandCoins, Receipt, DollarSign, ArrowUpRight, 
  Sparkles, Loader2, Network, Activity, Timer, ArrowRight, ArrowDownRight,
  Calendar, Stethoscope, UserX, Target, Zap, ChevronDown, Mail, Info,
  Smartphone, Filter, MoreHorizontal, Columns, List as ListIcon, 
  BarChart3, GripVertical, Edit3, Trash2, Plus, X
} from 'lucide-react';
import { analyzeLeadConversation } from '../services/geminiService';
import { sendMessage } from '../services/whatsappService';
import { useApp } from '../App';
import { Lead, ChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';

type ViewMode = 'kanban' | 'chat' | 'list' | 'metrics';

const Sales: React.FC = () => {
  const { dateFilter, setDateFilter, metrics, leads, addLead, updateLead, addFinancialEntry, user, whatsappConfig } = useApp();
  
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  
  // AI & Chat State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Lead Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLeadData, setNewLeadData] = useState({ name: '', phone: '', value: '' });

  // --- EFEITOS ---

  // Carrega chat quando seleciona lead
  useEffect(() => {
    if (!activeLead) return;
    const fetchMessages = async () => {
        const { data } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('contact_phone', activeLead.phone)
            .order('created_at', { ascending: true });
        if (data) setChatMessages(data as ChatMessage[]);
    };
    fetchMessages();

    const channel = supabase.channel(`chat-${activeLead.phone}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `contact_phone=eq.${activeLead.phone}` }, (payload) => {
            setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        })
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeLead]);

  // Scroll chat
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- HELPERS ---

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
      e.dataTransfer.setData('leadId', leadId);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      const leadId = e.dataTransfer.getData('leadId');
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.status !== newStatus) {
          await updateLead({ ...lead, status: newStatus as any });
          if (newStatus === 'Venda') {
             if(confirm(`Confirmar venda para ${lead.name}? Isso lançará R$ ${user?.ticketValue} no financeiro.`)) {
                await addFinancialEntry({
                   id: crypto.randomUUID(), type: 'receivable', category: 'Consulta Particular', 
                   name: `Consulta - ${lead.name}`, unitValue: user?.ticketValue || 450, 
                   total: user?.ticketValue || 450, status: 'efetuada',
                   date: new Date().toISOString().split('T')[0], discount: 0, addition: 0
                });
             }
          }
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeLead || !messageText.trim()) return;
      const text = messageText;
      setMessageText('');
      setSendingMsg(true);

      if (whatsappConfig?.isConnected && whatsappConfig.instanceName) {
          try {
             await sendMessage(whatsappConfig.instanceName, activeLead.phone, text);
          } catch (error) {
             alert('Erro ao enviar mensagem via API.');
          } finally {
             setSendingMsg(false);
          }
      } else {
          window.open(`https://wa.me/55${activeLead.phone}?text=${encodeURIComponent(text)}`, '_blank');
          setSendingMsg(false);
      }
  };

  const handleAnalyzeLead = async () => {
    if (!activeLead) return;
    setIsAnalyzing(true);
    const historyText = chatMessages.slice(-15).map(m => `${m.sender === 'me' ? 'Eu' : 'Cliente'}: ${m.body}`).join('\n');
    const result = await analyzeLeadConversation(activeLead.name, historyText || 'Sem mensagens recentes.');
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await addLead({
          id: '',
          name: newLeadData.name,
          phone: newLeadData.phone,
          status: 'Novo',
          temperature: 'Cold',
          potentialValue: Number(newLeadData.value) || 0,
          lastMessage: 'Adicionado manualmente'
      });
      setShowAddModal(false);
      setNewLeadData({ name: '', phone: '', value: '' });
  };

  // --- SUB-COMPONENTS ---

  const KanbanColumn = ({ status, title, color, border }: { status: string, title: string, color: string, border: string }) => {
      const columnLeads = leads.filter(l => l.status === status);
      const totalValue = columnLeads.reduce((acc, l) => acc + (l.potentialValue || 0), 0);

      return (
          <div 
            className={`min-w-[280px] w-full md:w-1/5 flex flex-col h-full rounded-2xl border ${border} ${color} transition-all`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, status)}
          >
              <div className="p-3 border-b border-black/5 flex justify-between items-center">
                  <div>
                      <h4 className="font-black text-navy text-xs uppercase tracking-widest">{title}</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{columnLeads.length} leads • R$ {totalValue.toLocaleString('pt-BR', { notation: 'compact' })}</p>
                  </div>
              </div>
              <div className="p-2 flex-1 overflow-y-auto custom-scrollbar space-y-2">
                  {columnLeads.map(lead => (
                      <div 
                        key={lead.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => { setActiveLead(lead); setViewMode('chat'); }}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-navy transition-all group"
                      >
                          <div className="flex justify-between items-start mb-2">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${lead.temperature === 'Hot' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>{lead.temperature}</span>
                              <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                          </div>
                          <h5 className="font-bold text-navy text-sm truncate">{lead.name}</h5>
                          <p className="text-[10px] text-slate-400 truncate mb-2">{lead.lastMessage || 'Sem interações'}</p>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                              <span className="text-[10px] font-bold text-emerald-600">R$ {lead.potentialValue}</span>
                              <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                  <Clock size={10} /> {lead.lastInteraction || 'Hoje'}
                              </div>
                          </div>
                      </div>
                  ))}
                  {columnLeads.length === 0 && (
                      <div className="h-20 flex items-center justify-center border-2 border-dashed border-black/5 rounded-xl text-black/20 text-xs font-bold uppercase">Vazio</div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col relative">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-navy tracking-tight">Pipeline de Vendas</h2>
          <div className="flex items-center gap-2">
            <p className="text-slate-500 text-sm">Gerencie leads, negociações e fechamentos.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
             <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-navy text-white shadow' : 'text-slate-400 hover:text-navy'}`} title="Kanban"><Columns size={18} /></button>
             <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-navy text-white shadow' : 'text-slate-400 hover:text-navy'}`} title="Lista"><ListIcon size={18} /></button>
             <button onClick={() => setViewMode('chat')} className={`p-2 rounded-lg transition-all ${viewMode === 'chat' ? 'bg-navy text-white shadow' : 'text-slate-400 hover:text-navy'}`} title="Chat"><MessageCircle size={18} /></button>
             <button onClick={() => setViewMode('metrics')} className={`p-2 rounded-lg transition-all ${viewMode === 'metrics' ? 'bg-navy text-white shadow' : 'text-slate-400 hover:text-navy'}`} title="Métricas"><BarChart3 size={18} /></button>
           </div>
           <button onClick={() => setShowAddModal(true)} className="bg-navy text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2">
             <Plus size={16} /> Novo Lead
           </button>
        </div>
      </header>

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
              <div className="flex gap-4 h-full min-w-[1200px]">
                  <KanbanColumn status="Novo" title="Novos Leads" color="bg-slate-50" border="border-slate-100" />
                  <KanbanColumn status="Conversa" title="Em Conversa" color="bg-blue-50/50" border="border-blue-100" />
                  <KanbanColumn status="Agendado" title="Agendados" color="bg-amber-50/50" border="border-amber-100" />
                  <KanbanColumn status="Venda" title="Vendas ($)" color="bg-emerald-50/50" border="border-emerald-100" />
                  <KanbanColumn status="Perdido" title="Perdidos" color="bg-rose-50/50" border="border-rose-100" />
              </div>
          </div>
      )}

      {/* CHAT VIEW */}
      {viewMode === 'chat' && (
          <div className="flex-1 flex gap-6 min-h-0 animate-in fade-in duration-300 overflow-hidden pb-4">
            {/* Sidebar Leads */}
            <div className="w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
               <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Buscar lead..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-navy text-navy font-bold" />
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {leads.map(lead => (
                       <div 
                         key={lead.id} 
                         onClick={() => setActiveLead(lead)}
                         className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${activeLead?.id === lead.id ? 'bg-slate-50 border-l-4 border-l-navy' : 'border-l-4 border-l-transparent'}`}
                       >
                           <div className="flex justify-between items-start mb-1">
                               <h4 className="text-xs font-bold text-navy truncate">{lead.name}</h4>
                               <span className="text-[9px] text-slate-400">{lead.lastInteraction || 'Hoje'}</span>
                           </div>
                           <p className="text-[10px] text-slate-500 truncate">{lead.lastMessage || '...'}</p>
                       </div>
                   ))}
               </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                {activeLead ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-navy text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    {activeLead.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-navy">{activeLead.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-mono">{activeLead.phone}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={activeLead.status}
                                    onChange={(e) => updateLead({ ...activeLead, status: e.target.value as any })}
                                    className="bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase rounded-lg px-2 py-1 outline-none cursor-pointer"
                                >
                                    <option value="Novo">Novo</option>
                                    <option value="Conversa">Conversa</option>
                                    <option value="Agendado">Agendado</option>
                                    <option value="Venda">Venda</option>
                                    <option value="Perdido">Perdido</option>
                                </select>
                                <button onClick={handleAnalyzeLead} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="Raio-X IA">
                                    {isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-[#e5ddd5] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-3 relative">
                            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")'}}></div>
                            
                            {aiAnalysis && (
                                <div className="z-10 bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-900 leading-relaxed whitespace-pre-line mb-4 shadow-sm mx-auto max-w-[90%] animate-in fade-in">
                                    <strong>Copilot Insight:</strong><br/>{aiAnalysis}
                                </div>
                            )}

                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`z-10 max-w-[75%] p-3 rounded-xl text-sm shadow-sm relative ${msg.sender === 'me' ? 'self-end bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'self-start bg-white text-gray-800 rounded-tl-none'}`}>
                                    {msg.body}
                                    <span className="text-[9px] text-gray-400 block text-right mt-1 opacity-70">
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                            <input 
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                className="flex-1 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-navy text-sm"
                                placeholder="Digite sua mensagem..."
                            />
                            <button disabled={sendingMsg || !messageText} className="p-3 bg-navy text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50">
                                {sendingMsg ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <MessageCircle size={48} className="mb-4 opacity-20"/>
                        <p className="text-xs font-bold uppercase tracking-widest">Selecione um lead para iniciar</p>
                    </div>
                )}
            </div>
          </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-auto custom-scrollbar flex-1">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                          <tr>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Temperatura</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Potencial</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {leads.map(lead => (
                              <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4">
                                      <p className="text-xs font-bold text-navy">{lead.name}</p>
                                      <p className="text-[9px] text-slate-400">{lead.phone}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          lead.status === 'Venda' ? 'bg-emerald-100 text-emerald-600' :
                                          lead.status === 'Novo' ? 'bg-slate-100 text-slate-500' :
                                          'bg-blue-100 text-blue-600'
                                      }`}>{lead.status}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${lead.temperature === 'Hot' ? 'text-orange-600 bg-orange-50' : 'text-blue-400 bg-blue-50'}`}>
                                          {lead.temperature}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-bold text-navy">
                                      R$ {lead.potentialValue?.toLocaleString('pt-BR')}
                                  </td>
                                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                                      <button onClick={() => { setActiveLead(lead); setViewMode('chat'); }} className="p-2 text-slate-400 hover:text-navy hover:bg-slate-100 rounded-lg">
                                          <MessageCircle size={14}/>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* METRICS VIEW */}
      {viewMode === 'metrics' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                      <h3 className="text-xs font-bold text-navy uppercase tracking-widest mb-6">Funil de Vendas (Quantidade)</h3>
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[
                                  { name: 'Novos', value: leads.filter(l => l.status === 'Novo').length, fill: '#64748b' },
                                  { name: 'Conversa', value: leads.filter(l => l.status === 'Conversa').length, fill: '#3b82f6' },
                                  { name: 'Agendado', value: leads.filter(l => l.status === 'Agendado').length, fill: '#f59e0b' },
                                  { name: 'Venda', value: leads.filter(l => l.status === 'Venda').length, fill: '#10b981' },
                              ]}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10, fill:'#94a3b8'}} dy={10}/>
                                  <YAxis hide/>
                                  <Tooltip cursor={{fill:'#f8fafc'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                                  <Bar dataKey="value" radius={[4,4,0,0]} barSize={40}>
                                      <Cell fill="#64748b"/>
                                      <Cell fill="#3b82f6"/>
                                      <Cell fill="#f59e0b"/>
                                      <Cell fill="#10b981"/>
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  <div className="bg-navy p-8 rounded-3xl text-white shadow-xl flex flex-col justify-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-10"><DollarSign size={100}/></div>
                      <div className="relative z-10">
                          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Valor em Pipeline</h4>
                          <p className="text-4xl font-black mb-1">
                              R$ {leads.filter(l => l.status !== 'Venda' && l.status !== 'Perdido').reduce((acc, l) => acc + (l.potentialValue || 0), 0).toLocaleString('pt-BR', { notation: 'compact' })}
                          </p>
                          <p className="text-xs text-slate-400">Em negociação ativa</p>
                      </div>
                      <div className="mt-8 relative z-10">
                          <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Vendas Totais</h4>
                          <p className="text-2xl font-bold">
                              R$ {metrics.vendas.vendas * (user?.ticketValue || 450)}
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL NOVO LEAD */}
      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-navy text-lg">Novo Lead</h3>
                      <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleAddLeadSubmit} className="p-8 space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</label>
                          <input required value={newLeadData.name} onChange={e => setNewLeadData({...newLeadData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp</label>
                          <input required value={newLeadData.phone} onChange={e => setNewLeadData({...newLeadData, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy" placeholder="11999999999" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Potencial (R$)</label>
                          <input type="number" value={newLeadData.value} onChange={e => setNewLeadData({...newLeadData, value: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy" />
                      </div>
                      <button type="submit" className="w-full bg-navy text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg mt-4">
                          Adicionar Lead
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Sales;
