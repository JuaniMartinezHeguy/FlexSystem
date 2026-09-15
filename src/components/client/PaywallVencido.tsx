import React, { useEffect, useState } from 'react';
import { Lock, MessageCircle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured, supabase, supabaseAdmin } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { formatDateART } from '../../lib/dateUtils';

export const PaywallVencido: React.FC = () => {
  const { user, subscription, logout, refreshSubscription } = useAuth();
  const [whatsappNum, setWhatsappNum] = useState('5491100000000');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    cargarWhatsapp();
  }, []);

  const cargarWhatsapp = async () => {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'whatsapp_recepcion')
        .maybeSingle();

      if (data) setWhatsappNum(data.valor);
    } else {
      const cfg = MockStore.getConfiguracion();
      const ws = cfg.find(c => c.clave === 'whatsapp_recepcion');
      if (ws) setWhatsappNum(ws.valor);
    }
  };

  const handleContactarRecepcion = () => {
    const phone = whatsappNum.replace(/\D/g, '');
    const mensaje = encodeURIComponent(
      `Hola Recepción Flex Gym, soy ${user?.nombre} ${user?.apellido} (DNI ${user?.dni}). Quisiera renovar mi cuota.`
    );
    window.open(`https://wa.me/${phone}?text=${mensaje}`, '_blank');
  };

  const handleVerificarManual = async () => {
    setChecking(true);
    await refreshSubscription();
    setTimeout(() => setChecking(false), 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col justify-between p-6 selection:bg-red-500 selection:text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-red-500 bg-red-950/60 border border-red-900/60 px-3 py-1 rounded-full flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Acceso Restringido
        </span>
        <button
          onClick={logout}
          className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 font-semibold"
        >
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>

      {/* Main Lock Card */}
      <div className="my-auto max-w-sm mx-auto text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-20 h-20 bg-red-600/10 border-2 border-red-500/30 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-red-600/20 animate-pulse">
            <Lock className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-zinc-100 tracking-tight">Tu Cuota está Vencida</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Hola <span className="text-zinc-200 font-bold">{user?.nombre}</span>, tu membresía finalizó el{' '}
            <span className="font-mono text-red-400 font-bold">
              {subscription ? formatDateART(subscription.fecha_vencimiento) : 'período anterior'}
            </span>
            . Renueva en recepción para seguir entrenando y desbloquear tu rutina en tiempo real.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3">
          <Button
            onClick={handleContactarRecepcion}
            variant="primary"
            size="lg"
            icon={<MessageCircle className="w-5 h-5 fill-current" />}
            className="w-full font-bold shadow-lg shadow-red-600/20"
          >
            Renovar por WhatsApp
          </Button>

          <Button
            onClick={handleVerificarManual}
            variant="secondary"
            size="md"
            loading={checking}
            icon={<RefreshCw className="w-4 h-4" />}
            className="w-full text-xs font-semibold"
          >
            Ya pagué (Comprobar estado)
          </Button>
        </div>

        <p className="text-[10px] text-zinc-500">
          Esta pantalla se desbloqueará en tiempo real automáticamente apenas recepción registre tu pago.
        </p>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10px] text-zinc-600 uppercase font-mono">
        FLEX GYM — BUENOS AIRES
      </div>
    </div>
  );
};
