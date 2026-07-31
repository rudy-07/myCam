import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, Check } from 'lucide-react';
import './Login.css';

const ResetPassword = () => {
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('input');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordCriteria, setPasswordCriteria] = useState({
      length: false,
      upper: false,
      lower: false,
      number: false,
      special: false
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
    else {
        setStatus('error');
        setMessage('Invalid or missing reset token.');
    }
  }, []);

  useEffect(() => {
    const pwd = passwords.new;
    const criteria = {
        length: pwd.length >= 8,
        upper: /[A-Z]/.test(pwd),
        lower: /[a-z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
    };
    setPasswordCriteria(criteria);
  }, [passwords.new]);

  const generatePassword = () => {
    const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowers = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specials = "!@#$%^&*()_+";
    
    let password = "";
    // Ensure at least one of each
    password += uppers.charAt(Math.floor(Math.random() * uppers.length));
    password += lowers.charAt(Math.floor(Math.random() * lowers.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += specials.charAt(Math.floor(Math.random() * specials.length));

    const chars = uppers + lowers + numbers + specials;
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Shuffle
    password = password.split('').sort(() => 0.5 - Math.random()).join('');

    setPasswords(prev => ({ ...prev, new: password, confirm: password }));
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
        setMessage('Passwords do not match');
        setStatus('error');
        return;
    }
    
    if (!Object.values(passwordCriteria).every(Boolean)) {
         setMessage("Password does not meet all requirements.");
         setStatus('error');
         return;
    }

    setStatus('loading');
    
    try {
      const response = await fetch('http://localhost:3000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: passwords.new })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to reset password');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Connection error');
    }
  };

  const calculateStrength = () => {
      return Object.values(passwordCriteria).filter(Boolean).length;
  };

  const strength = calculateStrength();

  const getStrengthColor = () => {
      if (strength <= 2) return '#ef4444'; // Red
      if (strength <= 4) return '#eab308'; // Yellow
      return '#22c55e'; // Green
  };

  return (
    <div className="login-container-wrapper">
       <div className="login-bg-shape login-bg-shape-1"></div>
       <div className="login-bg-shape login-bg-shape-2"></div>

      <div className="login-card">
        {status === 'success' ? (
            <div style={{textAlign: 'center'}}>
                <div className="message success" style={{marginBottom: '2rem'}}>
                    Password Reset Successfully!
                </div>
                <p className="login-footer-text" style={{marginBottom: '2rem'}}>
                    You can now log in with your new password.
                </p>
                <a href="/" className="login-btn" style={{textDecoration: 'none', display: 'block', textAlign: 'center'}}>
                    Back to Login
                </a>
            </div>
        ) : (
            <>
                {status === 'error' && <div className="message error">{message}</div>}
                
                <h2>New Password</h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="input-group relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="login-input"
                            placeholder="New Password"
                            value={passwords.new}
                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                            required
                        />
                         <button
                            type="button"
                            className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                         <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={generatePassword}
                            title="Suggest Strong Password"
                            >
                                <RefreshCw size={18} />
                            </button>
                    </div>

                    {/* Password Strength Bar */}
                    {passwords.new && (
                        <div style={{ marginTop: '-10px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${strength * 20}%`, height: '100%', backgroundColor: getStrengthColor(), transition: 'width 0.3s ease, background-color 0.3s ease' }}></div>
                            </div>
                        </div>
                    )}

                    <div className="input-group relative">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            className="login-input"
                            placeholder="Confirm Password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                            required
                        />
                         <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {/* Criteria List */}
                    <div style={{ padding: 0, margin: '0 0 20px 0', fontSize: '12px', color: '#94a3b8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: passwordCriteria.length ? '#22c55e' : 'inherit' }}>
                            {passwordCriteria.length ? <Check size={12} /> : <div style={{width: 12}} />} At least 8 characters
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: passwordCriteria.upper ? '#22c55e' : 'inherit' }}>
                            {passwordCriteria.upper ? <Check size={12} /> : <div style={{width: 12}} />} 1 Uppercase
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: passwordCriteria.lower ? '#22c55e' : 'inherit' }}>
                            {passwordCriteria.lower ? <Check size={12} /> : <div style={{width: 12}} />} 1 Lowercase
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: passwordCriteria.number ? '#22c55e' : 'inherit' }}>
                            {passwordCriteria.number ? <Check size={12} /> : <div style={{width: 12}} />} 1 Number
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: passwordCriteria.special ? '#22c55e' : 'inherit' }}>
                            {passwordCriteria.special ? <Check size={12} /> : <div style={{width: 12}} />} 1 Special Char
                        </div>
                    </div>

                    <button type="submit" className="login-btn" disabled={status === 'loading'}>
                        {status === 'loading' ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>

                 <p className="login-footer-text">
                    <a href="/" className="login-link">Cancel</a>
                </p>
            </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
