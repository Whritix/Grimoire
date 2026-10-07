import React from 'react';

export const GrimoireLogo = ({ className = "h-7 w-7" }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 28 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left and Right Open Book Pages */}
      <path d="M3 5.5C5.8 4 9.4 3.5 14 5.2C18.6 3.5 22.2 4 25 5.5V19.5C22.2 18 18.6 17.5 14 19.2C9.4 17.5 5.8 18 3 19.5V5.5Z" />
      <path d="M14 5.2V19.2" />
      {/* Subtle page curves for depth */}
      <path d="M5.5 8.2C7.5 7.2 10.2 6.8 13 8" strokeWidth="1.2" opacity="0.4" />
      <path d="M15 8C17.8 6.8 20.5 7.2 22.5 8.2" strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
};

export const ZentraLogo = GrimoireLogo;
