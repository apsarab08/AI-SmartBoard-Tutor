import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface SmartBoardProps {
  content: string;
  isWriting: boolean;
}

export const SmartBoard: React.FC<SmartBoardProps> = ({ content, isWriting }) => {
  return (
    <div className="w-full h-full bg-slate-900 border-4 border-slate-800 rounded-xl shadow-2xl p-8 relative overflow-hidden flex flex-col">
      {/* Board Texture/Grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={content}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="prose prose-invert max-w-none"
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </motion.div>
        </AnimatePresence>
        
        {isWriting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-2 h-6 bg-emerald-400 ml-1 align-middle"
          />
        )}
      </div>

      {/* Chalk/Marker Tray */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-2 bg-slate-700 rounded-t-lg" />
    </div>
  );
};
