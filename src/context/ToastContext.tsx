import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, Zap } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type?: ToastType;
}

interface ToastContextProps {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastItem = { id, title, message, type };

    setToasts((prev) => [...prev, newToast]);

    // Auto-desaparecer en 4 segundos
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Contenedor Fijo Arriba a la Derecha (Top-Right) */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full sm:w-80">
        <AnimatePresence mode="sync">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pointer-events-auto bg-gradient-to-r from-red-600 via-red-600 to-red-700 border border-red-500/80 p-4 rounded-2xl shadow-2xl shadow-red-950/80 flex items-start justify-between gap-3 text-white relative overflow-hidden group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-black/20 border border-white/20 rounded-xl text-white shrink-0 mt-0.5 shadow-inner">
                  {toast.type === 'error' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : toast.type === 'info' ? (
                    <Info className="w-5 h-5 text-white" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <h4 className="text-xs font-extrabold text-white tracking-tight flex items-center gap-1.5 uppercase">
                    {toast.title}
                    <Zap className="w-3 h-3 text-red-200 fill-white" />
                  </h4>
                  {toast.message && (
                    <p className="text-[11px] text-red-100 font-medium leading-relaxed">
                      {toast.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-black/20 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
};
