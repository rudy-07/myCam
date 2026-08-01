import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoIcon from '../assets/mycam_no_text.png';

const Navbar = ({ onLoginClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#060810]/80 backdrop-blur-xl border-b border-white/[0.07] py-3.5' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 group transition-all duration-300 hover:-translate-y-0.5">
          <img 
            src={logoIcon} 
            alt="myCam Logo" 
            className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
          />
          <span className="text-xl font-extrabold tracking-tight text-[#eef2ff]">
            my<span className="text-blue-500">Cam</span>
          </span>
        </a>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-xs font-medium text-slate-300 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-xs font-medium text-slate-300 hover:text-white transition-colors">Architecture</a>
          <a href="#pricing" className="text-xs font-medium text-slate-300 hover:text-white transition-colors">Pricing</a>
          <button 
            onClick={onLoginClick} 
            className="text-xs font-bold text-slate-200 hover:text-white px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all"
          >
            Sign In
          </button>
          <button 
            onClick={onLoginClick}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold px-5 py-2 rounded-full shadow-glow-sm transition-all hover:scale-105"
          >
            Get Started
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-slate-300 p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-[#0a0d1a]/95 backdrop-blur-2xl border-b border-white/[0.1] p-5 md:hidden flex flex-col gap-4 shadow-2xl"
            >
              <a href="#features" className="text-sm font-medium text-slate-300 hover:text-white py-1">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white py-1">Architecture</a>
              <a href="#pricing" className="text-sm font-medium text-slate-300 hover:text-white py-1">Pricing</a>
              <div className="h-px bg-white/10 my-1" />
              <button onClick={onLoginClick} className="text-xs font-bold text-slate-200 py-2">Sign In</button>
              <button 
                onClick={onLoginClick}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-glow-sm"
              >
                Get Started
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;

