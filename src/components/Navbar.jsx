import React, { useState, useEffect } from 'react';
import { Camera, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        isScrolled ? 'bg-background/80 backdrop-blur-md border-b border-surface/50 py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-primary-DEFAULT to-accent-DEFAULT p-2 rounded-lg">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            myCam
          </span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-slate-300 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">How it Works</a>
          <a href="#pricing" className="text-slate-300 hover:text-white transition-colors">Pricing</a>
          <button onClick={onLoginClick} className="bg-primary-DEFAULT/10 hover:bg-primary-DEFAULT/20 text-primary-glow font-semibold px-6 py-2 rounded-full border border-primary-DEFAULT/20 transition-all hover:scale-105">
            Login
          </button>
          <button className="bg-gradient-to-r from-primary-DEFAULT to-primary-hover text-white font-semibold px-6 py-2 rounded-full shadow-lg shadow-primary-DEFAULT/25 transition-all hover:scale-105 hover:shadow-primary-DEFAULT/40">
            Get Started
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-surface border-b border-slate-700 p-4 md:hidden flex flex-col gap-4 shadow-xl"
            >
              <a href="#features" className="text-slate-300 hover:text-white block py-2">Features</a>
              <a href="#how-it-works" className="text-slate-300 hover:text-white block py-2">How it Works</a>
              <a href="#pricing" className="text-slate-300 hover:text-white block py-2">Pricing</a>
              <hr className="border-slate-700" />
              <button onClick={onLoginClick} className="text-primary-glow font-semibold py-2">Login</button>
              <button className="bg-primary-DEFAULT text-white font-semibold px-6 py-2 rounded-lg">
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
