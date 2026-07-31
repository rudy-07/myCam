import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        className={`pointer-events-auto flex items-center gap-3 min-w-[300px] max-w-md p-4 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-up transition-all ${
                            toast.type === 'success' ? 'bg-green-900/80 border-green-700 text-green-100' :
                            toast.type === 'error' ? 'bg-red-900/80 border-red-700 text-red-100' :
                            'bg-slate-800/90 border-slate-700 text-white'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                        
                        <p className="flex-1 text-sm font-medium">{toast.message}</p>
                        
                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 opacity-70" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
