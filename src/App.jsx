import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { CameraStatusProvider } from './context/CameraStatusContext';
import Dashboard from './components/Dashboard/Dashboard';

// Public & Legal Pages
import LandingPage from './components/public/LandingPage';
import PrivacyPolicy from './components/public/PrivacyPolicy';
import TermsOfService from './components/public/TermsOfService';
import CookiePolicy from './components/public/CookiePolicy';
import CookieConsent from './components/public/CookieConsent';
import Contact from './components/public/Contact';

// Authentication Pages
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';

function readStoredUser() {
  try {
    const saved = localStorage.getItem('mycam_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const hasId = parsed && (typeof parsed.id === 'number' || (typeof parsed.id === 'string' && parsed.id.trim() !== ''));
    // A usable session always has a user id (the backend returns one); `{}` or other shapes are treated as signed out.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && hasId ? parsed : null;
  } catch {
    try { localStorage.removeItem('mycam_user'); } catch { /* ignore */ }
    return null;
  }
}

function persistUser(userData) {
  try {
    localStorage.setItem('mycam_user', JSON.stringify(userData));
    return true;
  } catch {
    return false;
  }
}

function clearStoredUser() {
  try {
    localStorage.removeItem('mycam_user');
    localStorage.removeItem('mycam_token');
  } catch { /* ignore */ }
}

function getInitialView() {
  if (typeof window === 'undefined') return 'landing';
  const searchParams = new URLSearchParams(window.location.search);
  const viewParam = searchParams.get('view');
  if (viewParam === 'login' || viewParam === 'register' || viewParam === 'forgot' || viewParam === 'reset' || viewParam === 'privacy' || viewParam === 'terms' || viewParam === 'cookies' || viewParam === 'contact') {
    return viewParam;
  }
  if (searchParams.get('token')) {
    return 'reset';
  }
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/login') return 'login';
  if (path === '/register') return 'register';
  if (path === '/forgot-password' || path === '/forgot') return 'forgot';
  if (path === '/reset-password' || path === '/reset') return 'reset';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  if (path === '/cookies') return 'cookies';
  if (path === '/contact') return 'contact';
  return 'landing';
}

function App() {
  const [user, setUser] = useState(readStoredUser);
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(readStoredUser()));
  const [currentView, setCurrentView] = useState(getInitialView);
  const [authNotice, setAuthNotice] = useState('');

  // Synchronize browser history and path changes
  const navigate = useCallback((view, updateHistory = true) => {
    setCurrentView(view);
    if (updateHistory && typeof window !== 'undefined') {
      let targetPath = '/';
      if (view === 'login') targetPath = '/login';
      else if (view === 'register') targetPath = '/register';
      else if (view === 'forgot') targetPath = '/forgot-password';
      else if (view === 'reset') targetPath = '/reset-password';
      else if (view === 'privacy') targetPath = '/privacy';
      else if (view === 'terms') targetPath = '/terms';
      else if (view === 'cookies') targetPath = '/cookies';
      else if (view === 'contact') targetPath = '/contact';

      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    }
  }, []);

  // Handle popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSuccess = (userData) => {
    persistUser(userData);
    setUser(userData);
    setIsLoggedIn(true);
    navigate('landing');
  };

  const handleUserUpdate = (patch) => {
    const next = { ...user, ...patch };
    persistUser(next);
    setUser(next);
  };

  const handleLogout = () => {
    clearStoredUser();
    setUser(null);
    setIsLoggedIn(false);
    navigate('landing');
    setAuthNotice('');
  };

  return (
    <ToastProvider>
      {/* Ambient background orbs for public/auth views only; disabled in operational dashboard */}
      {!isLoggedIn && (
        <>
          <div className="ambient-drift-container" aria-hidden="true">
            <div className="ambient-orb ambient-orb--1" />
            <div className="ambient-orb ambient-orb--2" />
            <div className="ambient-orb ambient-orb--3" />
          </div>
          <div className="ambient-grid-mesh" aria-hidden="true" />
        </>
      )}

      {isLoggedIn ? (
        <NotificationProvider>
          <CameraStatusProvider>
            <Dashboard
              user={user}
              onLogout={handleLogout}
              onUserUpdate={handleUserUpdate}
            />
          </CameraStatusProvider>
        </NotificationProvider>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}
          >
            {currentView === 'login' ? (
              <Login
                onLoginSuccess={handleLoginSuccess}
                onBack={() => navigate('landing')}
                onRegisterClick={() => navigate('register')}
                onForgotClick={() => navigate('forgot')}
                notice={authNotice}
              />
            ) : currentView === 'register' ? (
              <Register
                onRegisterSuccess={() => {
                  setAuthNotice('Account created successfully. Please sign in with your credentials.');
                  navigate('login');
                }}
                onBack={() => navigate('landing')}
                onLoginClick={() => navigate('login')}
                onTermsClick={() => navigate('terms')}
                onPrivacyClick={() => navigate('privacy')}
              />
            ) : currentView === 'forgot' ? (
              <ForgotPassword
                onBack={() => navigate('login')}
                onLoginClick={() => navigate('login')}
              />
            ) : currentView === 'reset' ? (
              <ResetPassword
                onBack={() => navigate('login')}
                onLoginClick={() => navigate('login')}
              />
            ) : currentView === 'privacy' ? (
              <PrivacyPolicy onBack={() => navigate('landing')} />
            ) : currentView === 'terms' ? (
              <TermsOfService onBack={() => navigate('landing')} />
            ) : currentView === 'cookies' ? (
              <CookiePolicy onBack={() => navigate('landing')} />
            ) : currentView === 'contact' ? (
              <Contact
                onBack={() => navigate('landing')}
                onNavigate={(target) => navigate(target)}
                onLoginClick={() => navigate('login')}
                onRegisterClick={() => navigate('register')}
                onPrivacyClick={() => navigate('privacy')}
              />
            ) : (
              <LandingPage
                onLoginClick={() => navigate('login')}
                onRegisterClick={() => navigate('register')}
                onNavigate={(target) => navigate(target)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Global Cookie Consent Banner & Modal for all public views */}
      {!isLoggedIn && <CookieConsent onOpenPolicy={() => navigate('cookies')} />}
    </ToastProvider>
  );
}

export default App;
