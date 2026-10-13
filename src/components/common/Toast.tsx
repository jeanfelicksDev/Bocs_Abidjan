import React, { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

// Singleton pour usage impératif depuis n'importe quel fichier
let _addToast: ((type: ToastType, message: string) => void) | null = null;

export function showToast(type: ToastType, message: string) {
  if (_addToast) {
    _addToast(type, message);
  } else {
    if (type === 'error') console.error('[BOCS]', message);
    else console.log('[BOCS]', message);
  }
}

export const toastSuccess = (msg: string) => showToast('success', msg);
export const toastError   = (msg: string) => showToast('error', msg);
export const toastWarning = (msg: string) => showToast('warning', msg);
export const toastInfo    = (msg: string) => showToast('info', msg);

const ICONS: Record<ToastType, string> = {
  success: 'check_circle', error: 'cancel', warning: 'warning', info: 'info',
};

// Rôles d'état des tokens : la notification suit le thème clair/sombre.
const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "var(--state-ok-bg)",   border: "var(--state-ok-line)",   icon: "var(--state-ok-ink)" },
  error:   { bg: "var(--state-late-bg)", border: "var(--state-late-line)", icon: "var(--state-late-ink)" },
  warning: { bg: "var(--state-wait-bg)", border: "var(--state-wait-line)", icon: "var(--state-wait-ink)" },
  info:    { bg: "var(--state-todo-bg)", border: "var(--state-todo-line)", icon: "var(--state-todo-ink)" },
};

const DURATION = 4500;

function SingleToast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[toast.type];

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast.id, onRemove]);

  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: '10px',
        padding: '12px 14px', boxShadow: 'var(--elevation-3)',
        minWidth: '280px', maxWidth: '400px',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(.22,1,.36,1), opacity 0.28s ease',
        pointerEvents: 'all', fontFamily: 'var(--font-sans)',
      }}
    >
      <span aria-hidden="true" className="material-symbols-outlined" style={{ color: c.icon, fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>
        {ICONS[toast.type]}
      </span>
      <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45, flex: 1 }}>
        {toast.message}
      </p>
      <button
        aria-label="Fermer la notification"
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, flexShrink: 0 }}
      >
        <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
      </button>
    </div>
  );
}

/** Montez ce composant une seule fois à la racine de App.tsx */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    setToasts(prev => [...prev, { id: Date.now() + Math.random(), type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none',
    }}>
      {toasts.map(t => <SingleToast key={t.id} toast={t} onRemove={removeToast} />)}
    </div>
  );
}
