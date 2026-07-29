import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { ClientLayout } from './components/layout/ClientLayout';
import { LoginClient } from './components/client/LoginClient';
import { Skeleton } from './components/common/Skeleton';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [forceClientView, setForceClientView] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
        <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase animate-pulse">
          Cargando IronHouse Gym...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginClient onSwitchToAdmin={() => {}} />;
  }

  // Si es Admin pero activó la vista previa de socio
  if (user.rol === 'admin' && forceClientView) {
    return <ClientLayout onSwitchToAdminMode={() => setForceClientView(false)} />;
  }

  // Render según rol
  if (user.rol === 'admin') {
    return <AdminLayout onSwitchToClientMode={() => setForceClientView(true)} />;
  }

  return <ClientLayout />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
