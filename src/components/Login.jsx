import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Login.css';
import { useToast } from '../context/ToastContext';

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
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Login successful
        console.log('Login successful:', data.user);
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
    <div className="login-container-wrapper">
         {/* Background shapes */}
        <div className="login-bg-shape login-bg-shape-1"></div>
        <div className="login-bg-shape login-bg-shape-2"></div>

      <div className="login-card">
        {error && <div className="message error">{error}</div>}
        
        <h2>Login to myCloud</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              name="username"
              className="login-input"
              placeholder="Username or Email"
              value={formData.username}
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="flex justify-end mb-6">
            <button 
                type="button" 
                onClick={onForgotClick}
                className="text-sm text-primary-DEFAULT hover:text-primary-hover transition-colors"
            >
                Forgot Password?
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <button className="social-btn google-btn">
          Login with Google
        </button>
        <button className="social-btn github-btn">
          Login with GitHub
        </button>

        <p className="login-footer-text">
          Don't have an account?{' '}
          <button 
            onClick={onRegisterClick} 
            className="login-link" 
            style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit'}}
          >
            Register here
          </button>
        </p>
        <p className="login-footer-text">
          <button 
            onClick={onForgotClick} 
            className="login-link" 
            style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit'}}
          >
            Forgot password?
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
