import React from 'react';
import { motion } from 'framer-motion';
import { Download, Shield, Smartphone } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative min-h-screen py-20 flex items-center justify-center overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-DEFAULT/20 rounded-full blur-[100px] animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-DEFAULT/10 rounded-full blur-[100px] animate-blob animation-delay-2000" />
      </div>

      <div className="container mx-auto px-4 pt-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface/50 border border-slate-700 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-accent-glow animate-pulse" />
            <span className="text-sm text-slate-300">Turn your old phone into a security camera</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            Advanced Security, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-glow to-accent-glow">
              Right within your Pocket
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            myCam transforms your spare smartphones into a powerful CCTV system. 
            Remote access, AI detection, and secure cloud storage — all in one app.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <button className="w-full md:w-auto px-8 py-4 bg-white text-background rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 group">
              <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
              Download App
            </button>
            <button className="w-full md:w-auto px-8 py-4 bg-surface border border-slate-700 text-white rounded-full font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5" />
              View Demo
            </button>
          </div>
        </motion.div>

        {/* Hero Image Mockup Area */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-20 relative mx-auto max-w-5xl"
        >
           <div className="relative z-10 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl shadow-primary-DEFAULT/10 aspect-video flex items-center justify-center group">
               {/* Placeholder until we have actual screenshots */}
               <div className="text-slate-500 flex flex-col items-center">
                  <Shield className="w-16 h-16 mb-4 text-slate-600 group-hover:text-primary-glow transition-colors" />
                  <p>App Interface Mockup</p>
               </div>
               
               {/* Decorative overlays */}
               <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-50" />
           </div>
           
           {/* Glow behind image */}
           <div className="absolute -inset-4 bg-gradient-to-tr from-primary-DEFAULT to-accent-DEFAULT opacity-20 blur-xl -z-10 rounded-xl" />
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
