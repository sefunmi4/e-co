import React, { useState } from 'react';

let zCounter = 20;

interface WindowProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Window({ children, className = '', style }: WindowProps) {
  const [z, setZ] = useState(() => ++zCounter);

  const bringToFront = () => {
    setZ(++zCounter);
  };

  return (
    <div
      className={`absolute ${className}`}
      style={{ ...style, zIndex: z }}
      onMouseDown={bringToFront}
    >
      {children}
    </div>
  );
}
