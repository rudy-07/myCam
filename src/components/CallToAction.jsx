import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Apple, Play } from 'lucide-react';

const CallToAction = () => {
  return (
    <section className="py-20 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary-DEFAULT/5 blur-3xl -z-10" />

      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto bg-gradient-to-br from-surface to-slate-900 border border-slate-700 p-12 rounded-3xl relative overflow-hidden"
        >
             {/* Decorative circles */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-DEFAULT/20 rounded-full blur-[80px]" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-accent-DEFAULT/20 rounded-full blur-[80px]" />

          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to secure your world?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
            Join thousands of users who trust myCam for their home and car security. 
            Download now and get started in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="flex items-center gap-3 px-8 py-4 bg-white text-background rounded-xl font-bold hover:scale-105 transition-transform">
              <Apple className="w-6 h-6" />
              <div className="text-left">
                <div className="text-xs font-medium text-slate-500">Download on the</div>
                <div className="text-sm">App Store</div>
              </div>
            </button>
            <button className="flex items-center gap-3 px-8 py-4 bg-surface border border-slate-600 text-white rounded-xl font-bold hover:scale-105 transition-transform hover:bg-slate-800">
              <div className="w-6 h-6 bg-transparent border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-1" /> {/* Pseudo play icon for Google Play style purely with css or just use icon */}
               {/* actually let's use the Lucide Play icon but styled appropriately or just text */}
               <Play className="w-6 h-6 fill-current" />
              <div className="text-left">
                 <div className="text-xs font-medium text-slate-400">GET IT ON</div>
                 <div className="text-sm">Google Play</div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CallToAction;
