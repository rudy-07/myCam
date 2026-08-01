import React, { useState } from 'react';
import './Login.css';
import { API_BASE } from '../config';

const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.message || 'Request failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container-wrapper">
      <div className="login-bg-shape login-bg-shape-1"></div>
      <div className="login-bg-shape login-bg-shape-2"></div>

      <div className="login-card">
        {message ? (
             <div style={{textAlign: 'center'}}>
                <div className="message success" style={{marginBottom: '2rem'}}>
                    {message}
                </div>
                <button 
                    onClick={onBack}
                    className="login-btn"
                >
                    Return to Login
                </button>
            </div>
        ) : (
            <>
                {error && <div className="message error">{error}</div>}
                <h2>Forgot Password?</h2>
                <p className="login-footer-text" style={{marginBottom: '1.5rem'}}>
                    Enter your email to receive a reset link.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            type="email"
                            className="login-input"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={isLoading}>
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                 <p className="login-footer-text">
                    <button onClick={onBack} className="login-link" style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}>
                        Back to Login
                    </button>
                </p>
            </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
