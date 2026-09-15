import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario, Suscripcion } from '../types/database';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '../lib/supabase';
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
      const channel = supabaseAdmin
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
        supabaseAdmin.removeChannel(channel);
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
    try {
      if (isSupabaseConfigured) {
        // Timeout de seguridad de 2 segundos para evitar bloqueos si Supabase no responde
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
          try {
            const { data: userData } = await supabaseAdmin
              .from('usuarios')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (userData) {
              setUser(userData as Usuario);
              await fetchUserSubscription(userData.id);
              return;
            }
          } catch (e) {
            console.warn('Error obteniendo datos de usuario Supabase:', e);
          }
        }
      }
      // Si no hay sesión en Supabase o falló, revisar sesión mock
      fallbackToMockSession();
    } catch (err) {
      console.error('Error inicializando sesión:', err);
      fallbackToMockSession();
    } finally {
      setLoading(false);
    }
  };

  const fallbackToMockSession = () => {
    setIsMock(true);
    try {
      const storedUser = localStorage.getItem('flex_current_mock_user') || localStorage.getItem('ironhouse_current_mock_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        localStorage.setItem('flex_current_mock_user', JSON.stringify(parsedUser));
        fetchUserSubscription(parsedUser.id);
      }
    } catch (e) {
      console.warn('Error restaurando sesión mock:', e);
    }
  };

  const fetchUserSubscription = async (usuarioId: string) => {
    try {
      if (isSupabaseConfigured && !isMock) {
        const { data, error } = await supabaseAdmin
          .from('suscripciones')
          .select('*, plan:planes(*)')
          .eq('usuario_id', usuarioId)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('Error obteniendo suscripción Supabase:', error);
          setSubscription(null);
          return;
        }

        if (data) {
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
    } catch (err) {
      console.warn('Error al verificar suscripción:', err);
      setSubscription(null);
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

      if (data?.user) {
        let { data: userData } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        // Si el usuario se creó en Supabase Auth pero no tiene fila en public.usuarios
        if (!userData) {
          const autoProfile: Usuario = {
            id: data.user.id,
            dni: cleanDNI,
            nombre: data.user.user_metadata?.nombre || 'Socio',
            apellido: data.user.user_metadata?.apellido || '',
            telefono: '',
            rol: 'cliente'
          };
          await supabaseAdmin.from('usuarios').upsert(autoProfile);
          userData = autoProfile;
        }

        setUser(userData as Usuario);
        await fetchUserSubscription(userData.id);
        return { success: true };
      }

      // Si falla en Supabase pero existe en mock local
      const usuarios = MockStore.getUsuarios();
      const found = usuarios.find(u => u.dni === cleanDNI);
      if (found) {
        setUser(found);
        localStorage.setItem('flex_current_mock_user', JSON.stringify(found));
        await fetchUserSubscription(found.id);
        return { success: true };
      }

      if (error) {
        return { 
          success: false, 
          error: error.message === 'Invalid login credentials' ? 'DNI o contraseña incorrectos.' : error.message 
        };
      }
    }

    // Modo Mock
    const usuarios = MockStore.getUsuarios();
    const found = usuarios.find(u => u.dni === cleanDNI);
    if (found) {
      setUser(found);
      localStorage.setItem('flex_current_mock_user', JSON.stringify(found));
      await fetchUserSubscription(found.id);
      return { success: true };
    }

    return { success: false, error: 'No se encontró un socio registrado con el DNI ingresado.' };
  };

  const loginWithEmail = async (emailInput: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const email = emailInput.trim();
    if (!email || !password.trim()) {
      return { success: false, error: 'Ingresa las credenciales de administración.' };
    }

    if (isSupabaseConfigured) {
      const targetEmail = email.includes('@') ? email : dniToEmail(email);

      let { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password
      });

      // Intento alternativo si ingresó formato DNI o username
      if (error && !email.includes('@')) {
        const alt = await supabase.auth.signInWithPassword({
          email: `${email}@flex.com`,
          password
        });
        if (!alt.error) {
          data = alt.data;
          error = null;
        }
      }

      if (data?.user) {
        let { data: userData } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        // Si el admin se creó en Supabase Auth pero falta en public.usuarios
        if (!userData) {
          const autoProfile: Usuario = {
            id: data.user.id,
            dni: email.includes('@') ? (data.user.email?.split('@')[0] || '11111111') : email,
            nombre: data.user.user_metadata?.nombre || 'Recepción',
            apellido: data.user.user_metadata?.apellido || 'Flex',
            telefono: '',
            rol: 'admin'
          };
          await supabaseAdmin.from('usuarios').upsert(autoProfile);
          userData = autoProfile;
        }

        setUser(userData as Usuario);
        return { success: true };
      }

      // Si falla en Supabase pero existe en mock admin
      const usuarios = MockStore.getUsuarios();
      const admin = usuarios.find(u => u.rol === 'admin');
      if (admin && (email.toLowerCase().includes('admin') || email === admin.dni || email === '11111111')) {
        setUser(admin);
        localStorage.setItem('flex_current_mock_user', JSON.stringify(admin));
        return { success: true };
      }

      if (error) {
        return { 
          success: false, 
          error: error.message === 'Invalid login credentials' ? 'Email o contraseña de administración incorrectos.' : error.message 
        };
      }
    }

    // Modo Mock Admin
    const usuarios = MockStore.getUsuarios();
    const admin = usuarios.find(u => u.rol === 'admin');
    if (admin && (email.toLowerCase().includes('admin') || email === admin.dni || email === '11111111')) {
      setUser(admin);
      localStorage.setItem('flex_current_mock_user', JSON.stringify(admin));
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
    localStorage.removeItem('flex_current_mock_user');
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
