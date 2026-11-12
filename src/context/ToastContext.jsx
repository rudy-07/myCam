import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Errors stay a little longer so they can be read. Callers may pass an explicit duration.
const DEFAULT_DURATION = { success: 4000, info: 4000, warning: 6000, error: 6000 };

const TYPE_META = {
    success: { cls: 'toast-success', Icon: CheckCircle2, color: 'text-success', role: 'status' },
    error: { cls: 'toast-error', Icon: AlertCircle, color: 'text-danger', role: 'alert' },
    warning: { cls: 'toast-warning', Icon: AlertTriangle, color: 'text-warning', role: 'status' },
    info: { cls: 'toast-info', Icon: Info, color: 'text-accent', role: 'status' },
};

const MAX_VISIBLE = 4;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    useEffect(() => () => {
        Object.values(timers.current).forEach((timer) => clearTimeout(timer));
        timers.current = {};
    }, []);

    const removeToast = useCallback((id) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'info', duration) => {
        const kind = TYPE_META[type] ? type : 'info';
        const ms = duration ?? DEFAULT_DURATION[kind];
        const id = Date.now() + Math.random();
        
        setToasts((prev) => {
            if (prev.some((t) => t.message === message && t.type === kind)) {
                return prev;
            }
            if (ms > 0) {
                timers.current[id] = setTimeout(() => removeToast(id), ms);
            }
            return [...prev, { id, message, type: kind, duration: ms }].slice(-MAX_VISIBLE);
        });

        return id;
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="toast-region" aria-label="Status messages" role="region">
                {toasts.map(toast => {
                    const { cls, Icon, color, role } = TYPE_META[toast.type];
                    return (
                        <div key={toast.id} role={role} className={`toast ${cls}`}>
                            <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} aria-hidden="true" />
                            <p className="min-w-0 flex-1 break-words">{toast.message}</p>
                            <button
                                type="button"
                                onClick={() => removeToast(toast.id)}
                                className="btn btn-ghost btn-icon btn-sm -my-1 -mr-1.5 shrink-0"
                                aria-label="Dismiss notification"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
