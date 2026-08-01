import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';
import logoIcon from '../assets/mycam_no_text.png';

const Login = ({ onLoginSuccess, onBack, onRegisterClick, onForgotClick }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        addToast(`Welcome back, ${data.user.name || 'User'}!`, 'success');
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient background layers */}
      <div className="shell-bg" />
      <div className="shell-bg-grid" />

      {/* Glass Card */}
      <div className="w-full max-w-md bg-[#0a0d1a]/85 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl p-8 relative z-10 animate-fade-up">
        {onBack && (
          <button 
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 border border-blue-500/30 p-2.5 mb-3 shadow-glow-sm">
            <img src={logoIcon} alt="myCam Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Sign in to my<span className="text-blue-500">Cam</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Access secure live feeds & cloud surveillance matrix
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold text-center animate-fade-in">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Username or Email</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                name="username"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/20 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-xs transition-all outline-none"
                placeholder="operator@mysphere.co.in"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password</label>
              <button 
                type="button" 
                onClick={onForgotClick}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/20 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-10 py-2.5 text-xs transition-all outline-none"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-glow-sm hover:shadow-glow transition-all duration-200 disabled:opacity-50" 
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-white/[0.06] pt-4">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <button 
              onClick={onRegisterClick} 
              className="font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

