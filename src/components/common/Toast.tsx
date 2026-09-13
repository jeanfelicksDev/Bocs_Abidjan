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

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; bar: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a', bar: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626', bar: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706', bar: '#d97706' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb', bar: '#2563eb' },
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
        background: c.bg, border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.bar}`, borderRadius: '12px',
        padding: '12px 14px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        minWidth: '280px', maxWidth: '400px',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(.22,1,.36,1), opacity 0.28s ease',
        pointerEvents: 'all', fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span className="material-symbols-outlined" style={{ color: c.icon, fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>
        {ICONS[toast.type]}
      </span>
      <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: '#1e293b', lineHeight: 1.45, flex: 1 }}>
        {toast.message}
      </p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, flexShrink: 0 }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
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
