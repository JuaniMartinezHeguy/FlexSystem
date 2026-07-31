import React, { useState } from 'react';
import { Dumbbell, Lock, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

interface LoginClientProps {
  onSwitchToAdmin: () => void;
}

export const LoginClient: React.FC<LoginClientProps> = ({ onSwitchToAdmin }) => {
  const { loginWithDNI, loginWithEmail } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Form Socio (DNI + Pass)
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');

  // Form Admin (Email + Pass)
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passAdmin, setPassAdmin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmitSocio = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!dni.trim() || !password.trim()) {
      setError('Por favor ingresa tu DNI y contraseña.');
      return;
    }

    setLoading(true);
    const res = await loginWithDNI(dni, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'No se pudo iniciar sesión.');
    }
  };

  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailAdmin.trim() || !passAdmin.trim()) {
      setError('Ingresa las credenciales de administración.');
      return;
    }

    setLoading(true);
    const res = await loginWithEmail(emailAdmin, passAdmin);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Credenciales no válidas.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 selection:bg-red-500 selection:text-white">
      <div className="w-full max-w-sm space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-red-600/10">
            <Dumbbell className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-100">
              IRONHOUSE <span className="text-red-500">GYM</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              {isAdminMode ? 'Acceso de Administración / Recepción' : 'Portal del Socio'}
            </p>
          </div>
        </div>

        {/* Card Formulario */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-2xl space-y-5">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-400 text-center font-medium">
              {error}
            </div>
          )}

          {!isAdminMode ? (
            /* FORMULARIO SOCIO */
            <form onSubmit={handleSubmitSocio} className="space-y-4">
              <Input
                label="DNI (Sin puntos)"
                placeholder="Ej. 40123456"
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                icon={<UserCheck className="w-4 h-4" />}
                required
              />

              <Input
                label="Contraseña"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                icon={<ArrowRight className="w-4 h-4" />}
                className="w-full font-bold text-sm shadow-red-600/30"
              >
                Ingresar al Portal
              </Button>
            </form>
          ) : (
            /* FORMULARIO ADMIN */
            <form onSubmit={handleSubmitAdmin} className="space-y-4">
              <Input
                label="Email o Usuario Admin"
                placeholder="admin@ironhouse.com o 11111111"
                type="text"
                value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
                required
              />

              <Input
                label="Contraseña"
                placeholder="••••••••"
                type="password"
                value={passAdmin}
                onChange={(e) => setPassAdmin(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                icon={<ShieldCheck className="w-4 h-4" />}
                className="w-full font-bold text-sm"
              >
                Ingresar a Administración
              </Button>
            </form>
          )}

          <div className="pt-2 text-center border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                setError('');
              }}
              className="text-xs text-zinc-400 hover:text-red-400 transition-colors font-medium"
            >
              {isAdminMode ? '← Volver a Login de Socio' : 'Acceso Recepción / Admin →'}
            </button>
          </div>
        </div>

        {/* Demo Quick Hints */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-2xl text-[11px] text-zinc-400 space-y-1 text-center">
          <p className="font-bold text-zinc-300">Credenciales para Pruebas Demo:</p>
          <p>Socio Al Día: DNI <span className="font-mono text-zinc-200 font-bold">40123456</span> | Clave: <span className="font-mono text-zinc-200 font-bold">40123456</span></p>
          <p>Socio Vencido: DNI <span className="font-mono text-zinc-200 font-bold">38999888</span> | Clave: <span className="font-mono text-zinc-200 font-bold">38999888</span></p>
          <p>Admin: DNI <span className="font-mono text-zinc-200 font-bold">11111111</span> | Clave: <span className="font-mono text-zinc-200 font-bold">admin123</span></p>
        </div>
      </div>
    </div>
  );
};
