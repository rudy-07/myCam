import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Eye, EyeOff, RefreshCw, Check, Type } from 'lucide-react';
import './Login.css';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';

const Register = ({ onRegisterSuccess, onBack }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordCriteria, setPasswordCriteria] = useState({
      length: false,
      upper: false,
      lower: false,
      number: false,
      special: false
  });

  // Password Analysis
  useEffect(() => {
    const pwd = formData.password;
    const criteria = {
        length: pwd.length >= 8,
        upper: /[A-Z]/.test(pwd),
        lower: /[a-z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
    };
    setPasswordCriteria(criteria);
  }, [formData.password]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

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

    setFormData(prev => ({ ...prev, password, confirmPassword: password }));
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
    }
    
    if (!Object.values(passwordCriteria).every(Boolean)) {
        setError("Password does not meet all requirements.");
        return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: formData.name,
            username: formData.username,
            email: formData.email,
            password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        addToast('Account created successfully! Please login.', 'success');
        if (onRegisterSuccess) {
            onRegisterSuccess();
        }
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
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

  const getStrengthLabel = () => {
      if (strength <= 2) return 'Weak';
      if (strength <= 4) return 'Fair';
      return 'Strong';
  };

  return (
    <div className="login-container-wrapper">
      <div className="login-bg-shape login-bg-shape-1"></div>
      <div className="login-bg-shape login-bg-shape-2"></div>

      <div className="login-card" style={{ maxWidth: '480px' }}>
        {error && <div className="message error">{error}</div>}
        
        <h2>Create Account</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              name="name"
              className="login-input"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="text"
              name="username"
              className="login-input"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="email"
              name="email"
              className="login-input"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              className="login-input"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
             <button
              type="button"
              className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? "Hide Password" : "Show Password"}
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
          {formData.password && (
            <div style={{ marginTop: '-10px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '4px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${strength * 20}%`, height: '100%', backgroundColor: getStrengthColor(), transition: 'width 0.3s ease, background-color 0.3s ease' }}></div>
                </div>
                <span style={{ fontSize: '12px', color: getStrengthColor(), fontWeight: 'bold' }}>{getStrengthLabel()}</span>
            </div>
          )}

          <div className="input-group relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              className="login-input"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
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

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="login-footer-text">
          Already have an account?{' '}
          <button onClick={onBack} className="login-link" style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}>
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;
