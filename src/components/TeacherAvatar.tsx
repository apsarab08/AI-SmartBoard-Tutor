import React from 'react';
import { motion } from 'motion/react';

interface TeacherAvatarProps {
  isSpeaking: boolean;
  action: string;
}

export const TeacherAvatar: React.FC<TeacherAvatarProps> = ({ isSpeaking, action }) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Body */}
        <motion.path
          d="M40,180 Q100,140 160,180 L160,200 L40,200 Z"
          fill="#2D3748"
          animate={{
            d: action === 'writing' 
              ? "M30,180 Q90,140 150,180 L150,200 L30,200 Z" 
              : "M40,180 Q100,140 160,180 L160,200 L40,200 Z"
          }}
        />
        
        {/* Head */}
        <motion.g
          animate={{
            y: isSpeaking ? [0, -2, 0] : 0,
            rotate: action === 'pointing' ? -5 : 0
          }}
          transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.5 }}
        >
          <circle cx="100" cy="80" r="50" fill="#E2E8F0" />
          
          {/* Eyes */}
          <circle cx="80" cy="70" r="5" fill="#1A202C" />
          <circle cx="120" cy="70" r="5" fill="#1A202C" />
          
          {/* Mouth */}
          <motion.path
            d={isSpeaking ? "M85,100 Q100,120 115,100" : "M85,105 Q100,105 115,105"}
            stroke="#1A202C"
            strokeWidth="3"
            fill="none"
            animate={{
              d: isSpeaking 
                ? ["M85,100 Q100,120 115,100", "M85,105 Q100,105 115,105"] 
                : "M85,105 Q100,105 115,105"
            }}
            transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.2 }}
          />
        </motion.g>

        {/* Arm/Hand for Pointing/Writing */}
        {action !== 'idle' && (
          <motion.path
            d={action === 'pointing' ? "M150,140 L180,100" : "M150,140 L170,160"}
            stroke="#2D3748"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
      </svg>
      
      {/* Speech Bubble Placeholder */}
      {isSpeaking && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -top-10 right-0 bg-white text-black px-4 py-2 rounded-2xl rounded-bl-none shadow-lg text-sm font-medium"
        >
          Explaining...
        </motion.div>
      )}
    </div>
  );
};
