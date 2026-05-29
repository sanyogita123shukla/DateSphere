import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { Toast as ToastType, ToastVariant } from '../types';

// ─── Context ──────────────────────────────────────────────────

interface ToastContextType {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  pii: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      setToasts((prev) => {
        const updated = [...prev, { id, message, variant, duration }];
        return updated.slice(-3); // Max 3 visible
      });
    },
    []
  );

  const value: ToastContextType = {
    addToast,
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
    pii: (msg) => addToast(msg, 'pii', 6000),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" id="toast-container">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Toast Item ───────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const icons: Record<ToastVariant, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    pii: '🛡',
  };

  return (
    <div
      className={`toast toast-${toast.variant} ${exiting ? 'toast-exit' : 'toast-enter'}`}
      onClick={() => {
        setExiting(true);
        setTimeout(onDismiss, 300);
      }}
      role="alert"
    >
      <span className="toast-icon">{icons[toast.variant]}</span>
      <span className="toast-message">{toast.message}</span>
      <div
        className="toast-progress"
        style={{ animationDuration: `${toast.duration || 4000}ms` }}
      />
    </div>
  );
}
