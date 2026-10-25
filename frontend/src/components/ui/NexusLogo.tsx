'use client';

import React from 'react';
import Image from 'next/image';

interface NexusLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  glow?: boolean;
  priority?: boolean;
}

export function NexusLogo({
  size = 'md',
  className = '',
  glow = false,
  priority = false,
}: NexusLogoProps) {
  let pixelSize = 28;
  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    switch (size) {
      case 'xs':
        pixelSize = 18;
        break;
      case 'sm':
        pixelSize = 24;
        break;
      case 'md':
        pixelSize = 28;
        break;
      case 'lg':
        pixelSize = 40;
        break;
      case 'xl':
        pixelSize = 64;
        break;
    }
  }

  // Choose the smallest optimal image asset based on display size
  const imageSrc = pixelSize <= 64 ? '/logo-icon.webp' : pixelSize <= 128 ? '/logo-128.webp' : '/logo-512.webp';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-lg overflow-hidden select-none transition-transform ${
        glow ? 'shadow-[0_0_12px_rgba(16,185,129,0.4)]' : ''
      } ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <Image
        src={imageSrc}
        alt="NexusRail Logo"
        width={pixelSize}
        height={pixelSize}
        priority={priority}
        className="w-full h-full object-contain rounded-lg"
      />
    </div>
  );
}
