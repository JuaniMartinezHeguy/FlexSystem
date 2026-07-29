import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { Lock, LogOut, Phone, ShieldCheck, User } from 'lucide-react';

interface PerfilClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerfilClientModal: React.FC<PerfilClientModalProps> = ({ isOpen, onClose }) => {
  const { user, logout, updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ error: '', success: '' });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje({ error: '', success: '' });
    if (!newPassword || newPassword.length < 4) {
      setMensaje({ error: 'La nueva contraseña debe tener al menos 4 caracteres.', success: '' });
      return;
    }

    setLoading(true);
    const res = await updatePassword(newPassword);
    setLoading(false);

    if (res.success) {
      setMensaje({ error: '', success: '¡Contraseña actualizada con éxito!' });
      setNewPassword('');
    } else {
      setMensaje({ error: res.error || 'Error al cambiar contraseña.', success: '' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mi Perfil de Socio">
      <div className="space-y-6">
        {/* User Card */}
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center font-black text-lg shrink-0">
            {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
          </div>
          <div>
            <h4 className="font-extrabold text-zinc-100 text-sm">{user?.nombre} {user?.apellido}</h4>
            <p className="text-xs text-zinc-400 font-mono">DNI: {user?.dni}</p>
            {user?.telefono && (
              <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-zinc-400" /> {user.telefono}
              </p>
            )}
          </div>
        </div>

        {/* Cambiar Contraseña */}
        <form onSubmit={handleChangePassword} className="space-y-4 pt-2 border-t border-zinc-800">
          <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-red-500" /> Cambiar Contraseña
          </h5>

          {mensaje.error && <p className="text-xs text-red-400 bg-red-950/60 p-2 rounded-lg">{mensaje.error}</p>}
          {mensaje.success && <p className="text-xs text-emerald-400 bg-emerald-950/60 p-2 rounded-lg">{mensaje.success}</p>}

          <Input
            type="password"
            label="Nueva Contraseña"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="secondary"
            loading={loading}
            className="w-full text-xs font-bold"
          >
            Actualizar Contraseña
          </Button>
        </form>

        {/* Logout */}
        <div className="pt-4 border-t border-zinc-800">
          <Button
            onClick={() => {
              onClose();
              logout();
            }}
            variant="danger"
            icon={<LogOut className="w-4 h-4" />}
            className="w-full text-xs font-bold"
          >
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </Modal>
  );
};
