import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import IntegrationSection from './components/IntegrationSection';
import CallToAction from './components/CallToAction';
import Footer from './components/Footer';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard/Dashboard';
import Broadcaster from './components/Broadcaster';

function App() {
  /* Initialize state from localStorage to prevent flash of landing page */
  const [user, setUser] = useState(() => {
      const saved = localStorage.getItem('mycam_user');
      return saved ? JSON.parse(saved) : null;
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('mycam_user'));

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleLoginSuccess = (userData) => {
    localStorage.setItem('mycam_user', JSON.stringify(userData));
    setUser(userData);
    setIsLoggedIn(true);
    setShowLogin(false);
    setShowRegister(false);
    setShowForgot(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('mycam_user');
    setUser(null);
    setIsLoggedIn(false);
    setShowLogin(false);
    setShowRegister(false);
    setShowForgot(false);
  };

  return (
    <ToastProvider>
      {isLoggedIn ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : showRegister ? (
        <Register 
            onRegisterSuccess={() => {
                alert('Account created! Please log in.');
                setShowRegister(false);
                setShowLogin(true);
            }} 
            onBack={() => setShowRegister(false)} 
        />
      ) : showForgot ? (
        <ForgotPassword onBack={() => setShowForgot(false)} />
      ) : showLogin ? (
        <Login 
            onLoginSuccess={handleLoginSuccess} 
            onBack={() => setShowLogin(false)}
            onRegisterClick={() => {
                setShowLogin(false);
                setShowRegister(true);
            }}
            onForgotClick={() => {
                setShowLogin(false);
                setShowForgot(true);
            }}
        />
      ) : (
        <div className="min-h-screen bg-background text-white selection:bg-primary-DEFAULT selection:text-white font-sans">
          <Navbar onLoginClick={() => setShowLogin(true)} />
          <Hero />
          <main>
            <Features />
            <IntegrationSection />
            <CallToAction />
          </main>
          <Footer />
        </div>
      )}
    </ToastProvider>
  );
}

export default App;
