import React from 'react';
import { 
  LayoutDashboard, 
  Megaphone, 
  Users, 
  Bot, 
  DollarSign, 
  Link2, 
  UserCircle,
  Calendar,
  LogOut
} from 'lucide-react';
import { AppSection } from '../types';
import { useApp } from '../App';

interface SidebarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate }) => {
  const { logout } = useApp();

  const menuItems = [
    { id: AppSection.DASHBOARD, label: 'Visão Geral', icon: <LayoutDashboard size={20} /> },
    { id: AppSection.VENDAS, label: 'CRM / Vendas', icon: <Users size={20} /> },
    { id: AppSection.AGENDA, label: 'Agenda', icon: <Calendar size={20} /> },
    { id: AppSection.FINANCEIRO, label: 'Financeiro', icon: <DollarSign size={20} /> },
    { id: AppSection.MARKETING, label: 'Marketing & Tráfego', icon: <Megaphone size={20} /> },
    { id: AppSection.AUTOMACAO, label: 'Inteligência IA', icon: <Bot size={20} /> },
    { id: AppSection.INTEGRACAO, label: 'Conexões', icon: <Link2 size={20} /> },
  ];

  const handleLogout = async () => {
    // Ação imediata (sem confirm) para melhor UX em mobile
    await logout();
  };

  return (
    <div className="w-72 md:w-64 bg-navy text-white h-full flex flex-col shadow-2xl md:shadow-none border-r border-white/5">
      <div className="p-6 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">COPILOT AI</h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-medium">Gestão & Crescimento</p>
      </div>
      
      {/* Added overflow-y-auto to allow scrolling on small screens if menu is tall */}
      <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
              activeSection === item.id 
                ? 'bg-white text-navy font-semibold shadow-lg scale-[1.02]' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {item.icon}
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2 shrink-0">
        <button
          onClick={() => onNavigate(AppSection.PERFIL)}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
            activeSection === AppSection.PERFIL 
              ? 'bg-white text-navy font-semibold shadow-lg' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <UserCircle size={20} />
          <span className="text-sm">Configurações</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:text-rose-400 hover:bg-slate-800 group"
        >
          <LogOut size={20} className="group-hover:text-rose-400" />
          <span className="text-sm">Sair da Conta</span>
        </button>

        <div className="mt-4 flex justify-center gap-3 text-[9px] font-medium text-slate-500 uppercase tracking-wider">
             <a href="/terms" className="hover:text-slate-300 transition-colors">Termos</a>
             <span>•</span>
             <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacidade</a>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;