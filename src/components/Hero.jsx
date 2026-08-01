import React from 'react';
import { motion } from 'framer-motion';
import { Download, Shield, Smartphone, Camera, Sparkles } from 'lucide-react';
import logoVector from '../assets/mycam_vector.png';

const Hero = () => {
  return (
    <section className="relative min-h-screen py-24 flex items-center justify-center overflow-hidden font-sans">
      {/* Ambient background layers */}
      <div className="shell-bg" />
      <div className="shell-bg-grid" />

      <div className="max-w-7xl mx-auto px-4 md:px-8 text-center pt-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide mb-8 backdrop-blur-md shadow-glow-sm">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Turn spare smartphones into enterprise CCTV nodes</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-100 mb-6 leading-tight">
            Intelligent Edge Security, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Reimagined for mySphere
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            myCam seamlessly connects mobile video feeds to the myCloud surveillance matrix. 
            Enjoy WebRTC low-latency streaming, AI polygon motion alerts, and automated storage recycling.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-full font-bold text-xs shadow-glow hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 group">
              <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              Launch Console
            </button>
            <button className="w-full sm:w-auto px-8 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-200 rounded-full font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-400" />
              Explore Live Matrix
            </button>
          </div>
        </motion.div>

        {/* Interface Mockup Display */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 relative mx-auto max-w-5xl"
        >
          <div className="relative z-10 bg-[#0a0d1a]/90 rounded-3xl overflow-hidden border border-white/10 shadow-2xl backdrop-blur-2xl aspect-video flex items-center justify-center group p-4">
            <img 
              src={logoVector} 
              alt="myCam Vector Display" 
              className="max-h-72 object-contain filter drop-shadow-[0_0_30px_rgba(59,130,246,0.3)] group-hover:scale-105 transition-transform duration-500" 
            />
            
            {/* Ambient inner shadow */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#060810]/90 via-transparent to-transparent pointer-events-none" />
          </div>
          
          {/* Subtle Glow behind container */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-3xl -z-10 rounded-3xl pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;

