import React from 'react';

export default function ForegroundOverlay() {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none bg-white/20 backdrop-blur-lg" />
  );
}
