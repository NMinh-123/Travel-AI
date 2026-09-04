import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'light' | 'dark' | 'gradient';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', variant = 'gradient' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-13 h-13'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-105 select-none ${
        sizeClasses[size]
      } ${
        variant === 'gradient'
          ? 'bg-gradient-to-br from-[#005c55] via-[#0f766e] to-[#0051d5] shadow-md shadow-[#005c55]/20'
          : variant === 'dark'
          ? 'bg-[#181c1c] border border-white/15 shadow-sm'
          : 'bg-white text-[#005c55] border border-[#bdc9c6]/40 shadow-xs'
      } ${className}`}
    >
      {/* Sleek SVG Minimalist Logo: Iconic Double Mountain Peak + AI Star Node */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} text-white`}
      >
        {/* Main High Mountain Peak (Mã Pí Lèng) */}
        <path
          d="M8 38L23 13L32 28L37 19L44 38H8Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        
        {/* Mountain Contour Ridge Stroke */}
        <path
          d="M6 38L22 12L31 27L36 19L44 38"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner Peak Valley Line */}
        <path
          d="M22 12L24 38"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2 3"
          strokeOpacity="0.6"
        />

        {/* AI Sparkling Spark Node on the Summit */}
        <circle cx="22" cy="12" r="3" fill="#80d5cb" stroke="currentColor" strokeWidth="1.5" />
        
        {/* Four-point AI Sparkle above peak */}
        <path
          d="M36 7L37.2 10.8L41 12L37.2 13.2L36 17L34.8 13.2L31 12L34.8 10.8L36 7Z"
          fill="#a3faef"
        />
      </svg>
    </div>
  );
};
