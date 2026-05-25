import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

let addToastFn: ((message: string, type?: 'info' | 'success' | 'error') => void) | null = null;

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  addToastFn?.(message, type);
}

const typeStyles = {
  info: 'bg-dark-700 border-white/10',
  success: 'bg-emerald-900/80 border-success/30',
  error: 'bg-red-900/80 border-danger/30',
};

let nextId = 0;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`px-4 py-2.5 rounded-btn border text-sm font-medium backdrop-blur-lg shadow-lg
              ${typeStyles[toast.type]}`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
