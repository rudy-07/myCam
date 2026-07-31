import React from 'react';
import { motion } from 'framer-motion';
import { Cloud, Lock, Share2 } from 'lucide-react';

const IntegrationSection = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute -right-20 top-40 w-96 h-96 bg-primary-DEFAULT/10 rounded-full blur-[100px]" />

      <div className="container mx-auto px-4 flex flex-col lg:flex-row items-center gap-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="lg:w-1/2"
        >
          <div className="inline-block p-3 rounded-2xl bg-primary-DEFAULT/10 mb-6">
            <Cloud className="w-8 h-8 text-primary-glow" />
          </div>
          <h2 className="text-4xl font-bold mb-6">
            Seamless Integration with <br />
            <span className="text-white">myCloud</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Don't risk losing your footage if your device is damaged or stolen. 
            With myCloud integration, your recordings are securely uploaded and stored in the cloud.
            Access them from anywhere, anytime.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Lock className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Bank-level Encryption</h4>
                <p className="text-slate-400 text-sm">Your data is encrypted both in transit and at rest.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Share2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                 <h4 className="font-semibold text-white">Easy Sharing</h4>
                 <p className="text-slate-400 text-sm">Share clips with family or law enforcement in just a few taps.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           transition={{ duration: 0.6, delay: 0.2 }}
           className="lg:w-1/2 relative"
        >
            <div className="bg-gradient-to-tr from-slate-800 to-slate-700/50 p-1 rounded-2xl shadow-2xl">
                <div className="bg-slate-900 rounded-xl p-8 aspect-video flex items-center justify-center border border-white/5 relative overflow-hidden group">
                    <Cloud className="w-32 h-32 text-primary-DEFAULT/20 group-hover:text-primary-DEFAULT/40 transition-colors duration-500" />
                    <div className="absolute bottom-6 right-6 p-4 bg-surface/80 backdrop-blur-md rounded-xl border border-white/10 shadow-lg flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         <span className="text-sm font-mono">Syncing...</span>
                    </div>
                </div>
            </div>
        </motion.div>
      </div>
    </section>
  );
};

export default IntegrationSection;
