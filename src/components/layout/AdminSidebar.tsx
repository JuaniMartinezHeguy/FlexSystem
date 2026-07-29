import React from 'react';
import { 
  UserPlus, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Settings, 
  LogOut, 
  Dumbbell,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type AdminSection = 'registro' | 'alumnos' | 'stats' | 'gastos' | 'configuracion';

interface AdminSidebarProps {
  currentSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  onSwitchToClientMode?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentSection,
  onSelectSection,
  onSwitchToClientMode
}) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'registro', label: 'Registro & Cobro', icon: UserPlus },
    { id: 'alumnos', label: 'Alumnos', icon: Users },
    { id: 'stats', label: 'Stats Gimnasio', icon: TrendingUp },
    { id: 'gastos', label: 'Gastos & Rentabilidad', icon: DollarSign },
    { id: 'configuracion', label: 'Planes & Config', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-screen shrink-0 sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white uppercase flex items-center gap-1.5">
              IRONHOUSE
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/50 px-2 py-0.5 rounded-full border border-red-900/50">
              <ShieldCheck className="w-3 h-3" /> Panel Admin
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id as AdminSection)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all text-left ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer User & Logout */}
      <div className="p-4 border-t border-zinc-800/80 space-y-2">
        {onSwitchToClientMode && (
          <button
            onClick={onSwitchToClientMode}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-colors"
          >
            <Smartphone className="w-4 h-4 text-red-500" />
            <span>Vista Previa Socio (PWA)</span>
          </button>
        )}

        <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
          <div className="truncate">
            <p className="text-xs font-bold text-zinc-100 truncate">{user?.nombre || 'Recepción'} {user?.apellido || ''}</p>
            <p className="text-[10px] text-zinc-400">Administrador</p>
          </div>
          <button
            onClick={logout}
            title="Cerrar Sesión"
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
