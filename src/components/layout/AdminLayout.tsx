import React, { useState } from 'react';
import { AdminSidebar, AdminSection } from './AdminSidebar';
import { RegistroCobroRapido } from '../admin/RegistroCobroRapido';
import { TablaAlumnos } from '../admin/TablaAlumnos';
import { StatsGimnasio } from '../admin/StatsGimnasio';
import { GastosRentabilidad } from '../admin/GastosRentabilidad';
import { ConfigPlanes } from '../admin/ConfigPlanes';
import { Wifi, WifiOff } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

interface AdminLayoutProps {
  onSwitchToClientMode?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onSwitchToClientMode }) => {
  const [currentSection, setCurrentSection] = useState<AdminSection>('registro');

  const renderSection = () => {
    switch (currentSection) {
      case 'registro':
        return <RegistroCobroRapido onNavigateToAlumnos={() => setCurrentSection('alumnos')} />;
      case 'alumnos':
        return <TablaAlumnos />;
      case 'stats':
        return <StatsGimnasio />;
      case 'gastos':
        return <GastosRentabilidad />;
      case 'configuracion':
        return <ConfigPlanes />;
      default:
        return <RegistroCobroRapido onNavigateToAlumnos={() => setCurrentSection('alumnos')} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Sidebar Fija */}
      <AdminSidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        onSwitchToClientMode={onSwitchToClientMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20 px-8 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Panel de Control</span>
            <h2 className="text-lg font-bold text-zinc-100 capitalize">
              {currentSection === 'registro' && 'Registro & Cobro Rápido'}
              {currentSection === 'alumnos' && 'Gestión de Alumnos'}
              {currentSection === 'stats' && 'Estadísticas del Gimnasio'}
              {currentSection === 'gastos' && 'Gastos & Rentabilidad'}
              {currentSection === 'configuracion' && 'Planes & Configuración Global'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge Supabase/Mock */}
            {isSupabaseConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                <Wifi className="w-3.5 h-3.5" /> Supabase Realtime
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/80">
                <WifiOff className="w-3.5 h-3.5" /> Modo Local Demo
              </span>
            )}
          </div>
        </header>

        {/* Dynamic Body */}
        <div className="p-8 flex-1">
          {renderSection()}
        </div>
      </main>
    </div>
  );
};
