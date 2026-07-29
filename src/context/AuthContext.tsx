import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario, Suscripcion } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dniToEmail } from '../lib/authHelpers';
import { MockStore } from '../lib/mockStore';
import { getTodayART, isSubscriptionExpired } from '../lib/dateUtils';

interface AuthContextType {
  user: Usuario | null;
  subscription: Suscripcion | null;
  loading: boolean;
  isMock: boolean;
  loginWithDNI: (dni: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [subscription, setSubscription] = useState<Suscripcion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMock, setIsMock] = useState<boolean>(!isSupabaseConfigured);

  // Cargar usuario inicial desde Supabase Auth o LocalStorage Mock
  useEffect(() => {
    initSession();
  }, []);

  // Suscripción Realtime a cambios en la tabla 'suscripciones' para auto-desbloquear al socio si cambia el estado
  useEffect(() => {
    if (!user || user.rol !== 'cliente') return;

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('realtime-suscripcion-cliente')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'suscripciones',
            filter: `usuario_id=eq.${user.id}`
          },
          () => {
            fetchUserSubscription(user.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // En modo mock, escuchamos un evento personalizado para actualización en vivo entre ventanas
      const handleStorageChange = () => {
        fetchUserSubscription(user.id);
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [user]);

  const initSession = async () => {
    setLoading(true);
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userData } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userData) {
            setUser(userData as Usuario);
            await fetchUserSubscription(userData.id);
          }
        }
      } catch (err) {
        console.error('Error inicializando sesión Supabase', err);
        fallbackToMockSession();
      }
    } else {
      fallbackToMockSession();
    }
    setLoading(false);
  };

  const fallbackToMockSession = () => {
    setIsMock(true);
    const storedUser = localStorage.getItem('ironhouse_current_mock_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchUserSubscription(parsedUser.id);
    }
  };

  const fetchUserSubscription = async (usuarioId: string) => {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('suscripciones')
        .select('*, plan:planes(*)')
        .eq('usuario_id', usuarioId)
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        // Verificar si expiró hoy
        const hoy = getTodayART();
        const expired = isSubscriptionExpired(data.fecha_vencimiento);
        const subData = {
          ...data,
          estado: expired ? ('vencida' as const) : ('activa' as const)
        };
        setSubscription(subData as Suscripcion);
      } else {
        setSubscription(null);
      }
    } else {
      const subs = MockStore.getSuscripciones();
      const userSub = subs
        .filter(s => s.usuario_id === usuarioId)
        .sort((a, b) => new Date(b.creado_en || 0).getTime() - new Date(a.creado_en || 0).getTime())[0];

      if (userSub) {
        const planes = MockStore.getPlanes();
        const plan = planes.find(p => p.id === userSub.plan_id);
        const expired = isSubscriptionExpired(userSub.fecha_vencimiento);
        setSubscription({
          ...userSub,
          estado: expired ? 'vencida' : 'activa',
          plan
        });
      } else {
        setSubscription(null);
      }
    }
  };

  const loginWithDNI = async (dni: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanDNI = dni.trim().replace(/\D/g, '');
    if (!cleanDNI) return { success: false, error: 'Ingrese un número de DNI válido.' };

    if (isSupabaseConfigured) {
      const email = dniToEmail(cleanDNI);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) return { success: false, error: 'DNI o contraseña incorrectos.' };
      if (data.user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userData) {
          setUser(userData as Usuario);
          await fetchUserSubscription(userData.id);
          return { success: true };
        }
      }
    }

    // Modo Mock
    const usuarios = MockStore.getUsuarios();
    const found = usuarios.find(u => u.dni === cleanDNI);
    if (found) {
      setUser(found);
      localStorage.setItem('ironhouse_current_mock_user', JSON.stringify(found));
      await fetchUserSubscription(found.id);
      return { success: true };
    }

    return { success: false, error: 'No se encontró un socio registrado con el DNI ingresado.' };
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) return { success: false, error: 'Credenciales de recepción incorrectas.' };
      if (data.user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userData) {
          setUser(userData as Usuario);
          return { success: true };
        }
      }
    }

    // Modo Mock Admin
    const usuarios = MockStore.getUsuarios();
    const admin = usuarios.find(u => u.rol === 'admin');
    if (admin && (email.toLowerCase().includes('admin') || email === admin.dni)) {
      setUser(admin);
      localStorage.setItem('ironhouse_current_mock_user', JSON.stringify(admin));
      return { success: true };
    }

    return { success: false, error: 'Credenciales de acceso de administración no válidas.' };
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSubscription(null);
    localStorage.removeItem('ironhouse_current_mock_user');
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (newPassword.length < 4) {
      return { success: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    // Modo mock
    return { success: true };
  };

  const refreshSubscription = async () => {
    if (user) {
      await fetchUserSubscription(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        loading,
        isMock,
        loginWithDNI,
        loginWithEmail,
        logout,
        updatePassword,
        refreshSubscription
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
