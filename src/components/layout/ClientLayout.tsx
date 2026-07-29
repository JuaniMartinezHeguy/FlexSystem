import React, { useState } from 'react';
import { HomeClient } from '../client/HomeClient';
import { MiRutinaSemanal } from '../client/MiRutinaSemanal';
import { HistorialEstadisticas } from '../client/HistorialEstadisticas';
import { PaywallVencido } from '../client/PaywallVencido';
import { PerfilClientModal } from '../client/PerfilClientModal';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, 
  Dumbbell, 
  BarChart3, 
  User, 
  ShieldCheck
} from 'lucide-react';
import { isSubscriptionExpired } from '../../lib/dateUtils';

type ClientTab = 'home' | 'rutina' | 'stats';

interface ClientLayoutProps {
  onSwitchToAdminMode?: () => void;
}

export const ClientLayout: React.FC<ClientLayoutProps> = ({ onSwitchToAdminMode }) => {
  const { user, subscription } = useAuth();
  const [activeTab, setActiveTab] = useState<ClientTab>('home');
  const [perfilOpen, setPerfilOpen] = useState(false);

  // Comprobar Paywall Vencido
  const estaVencido = subscription
    ? isSubscriptionExpired(subscription.fecha_vencimiento)
    : false;

  if (estaVencido && user?.rol === 'cliente') {
    return <PaywallVencido />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-red-500 selection:text-white max-w-md mx-auto relative border-x border-zinc-800/40 shadow-2xl">
      {/* Top Mobile Header */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-30 px-5 flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center font-black">
            <Dumbbell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-xs tracking-tight text-white uppercase">IRONHOUSE</h1>
            <span className="text-[10px] text-zinc-400 font-medium">Hola, {user?.nombre || 'Socio'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.rol === 'admin' && onSwitchToAdminMode && (
            <button
              onClick={onSwitchToAdminMode}
              title="Volver a Admin"
              className="p-2 bg-red-950/60 border border-red-800/60 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <ShieldCheck className="w-4 h-4" /> Admin
            </button>
          )}

          <button
            onClick={() => setPerfilOpen(true)}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:border-red-500 transition-colors"
          >
            <User className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 p-5 overflow-y-auto">
        {activeTab === 'home' && <HomeClient />}
        {activeTab === 'rutina' && <MiRutinaSemanal />}
        {activeTab === 'stats' && <HistorialEstadisticas />}
      </main>

      {/* Bottom PWA Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/95 backdrop-blur border-t border-zinc-800/80 px-6 py-2 z-30 pb-safe">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'home' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Inicio</span>
          </button>

          <button
            onClick={() => setActiveTab('rutina')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'rutina' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[10px]">Mi Rutina</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'stats' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px]">Stats</span>
          </button>
        </div>
      </nav>

      {/* Modal de Perfil */}
      <PerfilClientModal isOpen={perfilOpen} onClose={() => setPerfilOpen(false)} />
    </div>
  );
};
