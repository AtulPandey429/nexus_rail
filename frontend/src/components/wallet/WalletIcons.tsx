import React from 'react';

/**
 * Official GemWallet Icon (Blue faceted diamond cut matching screenshots 1 & 4)
 */
export function GemWalletIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2563EB" />
      {/* Faceted Diamond */}
      <g transform="translate(8, 9) scale(0.667)">
        {/* Top table */}
        <path d="M15 6L33 6L40 18L8 18L15 6Z" fill="#7DD3FC" />
        {/* Center table highlight */}
        <path d="M18 6L30 6L34 18L14 18L18 6Z" fill="#BAE6FD" />
        {/* Lower body facets */}
        <path d="M8 18L24 42L18 18H8Z" fill="#0284C7" />
        <path d="M18 18L24 42L30 18H18Z" fill="#38BDF8" />
        <path d="M30 18L24 42L40 18H30Z" fill="#0369A1" />
        {/* Specular gloss shimmer */}
        <path d="M21 9L27 9L28 15L20 15L21 9Z" fill="white" fillOpacity="0.85" />
      </g>
    </svg>
  );
}

/**
 * Official Xaman (formerly Xumm) Icon (Royal blue rounded badge with wave lines & xv emblem)
 */
export function XamanIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#0F47F2" />
      {/* Background contour waves */}
      <path
        d="M6 18C12 14 18 16 24 13C30 10 36 12 42 8"
        stroke="#1E40AF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M6 28C14 24 22 26 30 22C36 19 40 21 44 19"
        stroke="#1E40AF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M6 38C12 34 20 37 28 33C34 30 40 33 44 31"
        stroke="#1E40AF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* White 'x' and 'v' (check mark) monogram */}
      <g transform="translate(10, 13)">
        {/* Left 'X' crossing bar */}
        <path
          d="M4 6L14 16M14 6L4 16"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right 'V' / Checkmark extending up */}
        <path
          d="M15 13L19 18L26 4"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * Official Crossmark Icon (Coral/pink gradient with 4-pointed curved star)
 */
export function CrossmarkIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cm-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF2E55" />
          <stop offset="1" stopColor="#FF577A" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#cm-grad)" />
      {/* 4-Pointed Curved Star */}
      <path
        d="M24 10C24 16 28 20 34 20C28 20 24 24 24 30C24 24 20 20 14 20C20 20 24 16 24 10Z"
        fill="none"
        stroke="white"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="20" r="1.8" fill="white" />
    </svg>
  );
}

/**
 * Official Freighter Icon (Purple/violet gradient with white key logo)
 */
export function FreighterIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fr-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F1EA4" />
          <stop offset="1" stopColor="#7E3AF2" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#fr-grad)" />
      {/* Key Emblem */}
      <g transform="translate(10, 15)">
        {/* Key Bow (Round Ring) */}
        <circle cx="8" cy="9" r="6" stroke="white" strokeWidth="3" />
        <circle cx="8" cy="9" r="2.2" fill="white" />
        {/* Key Shaft */}
        <path d="M14 9H26" stroke="white" strokeWidth="3" strokeLinecap="round" />
        {/* Key Bits / Teeth */}
        <path d="M22 9V14" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M26 9V14" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Official Rabet Icon (Dark slate background with origami rabbit ears)
 */
export function RabetIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#181A20" />
      {/* Origami Rabbit Ears */}
      <g transform="translate(14, 11)">
        <path
          d="M4 22L1 7L7 12L10 22H4Z"
          fill="white"
          fillOpacity="0.9"
        />
        <path
          d="M16 22L19 7L13 12L10 22H16Z"
          fill="white"
          fillOpacity="0.75"
        />
        <path
          d="M7 12L10 22L13 12L10 16L7 12Z"
          fill="#38BDF8"
        />
        <circle cx="10" cy="24" r="2" fill="white" />
      </g>
    </svg>
  );
}

/**
 * Official Albedo Icon (White circle with electric cyan/blue A)
 */
export function AlbedoIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#FFFFFF" />
      {/* Stylized Cyan-Blue 'A' */}
      <path
        d="M24 10L14 36H19L24 23L29 36H34L24 10Z"
        fill="#0066FF"
      />
      <circle cx="24" cy="27" r="3.5" fill="#00D2FF" />
    </svg>
  );
}

/**
 * Official LOBSTR Icon (Cyan-blue gradient with white curved lobster/wave)
 */
export function LobstrIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lob-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A3FF" />
          <stop offset="1" stopColor="#0077E6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#lob-grad)" />
      {/* Lobster Drop/Wave Shape */}
      <path
        d="M24 11C18 11 14 16 14 22C14 29 20 33 24 37C28 33 34 29 34 22C34 16 30 11 24 11Z"
        fill="white"
      />
      <circle cx="24" cy="20" r="3.5" fill="#00A3FF" />
    </svg>
  );
}

/**
 * Official WalletConnect Icon (Bright blue with white 'W')
 */
export function WalletConnectIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#3B99FC" />
      {/* WalletConnect 'W' Logo */}
      <path
        d="M14 20C19.5 14.5 28.5 14.5 34 20L34.8 20.8C35.2 21.2 35.2 21.8 34.8 22.2L32.2 24.8C32 25 31.6 25 31.4 24.8L30.2 23.6C26.8 20.2 21.2 20.2 17.8 23.6L16.4 25C16.2 25.2 15.8 25.2 15.6 25L13 22.4C12.6 22 12.6 21.4 13 21L14 20ZM38.4 24.4L40.8 26.8C41.2 27.2 41.2 27.8 40.8 28.2L30.4 38.6C30 39 29.4 39 29 38.6L24.1 33.7C24 33.6 23.8 33.6 23.7 33.7L18.8 38.6C18.4 39 17.8 39 17.4 38.6L7 28.2C6.6 27.8 6.6 27.2 7 26.8L9.4 24.4C9.8 24 10.4 24 10.8 24.4L18.1 31.7C18.2 31.8 18.4 31.8 18.5 31.7L23.4 26.8C23.8 26.4 24.4 26.4 24.8 26.8L29.7 31.7C29.8 31.8 30 31.8 30.1 31.7L37.4 24.4C37.8 24 38.4 24 38.8 24.4H38.4Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * MetaMask Fox Icon
 */
export function MetaMaskIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2E1805" />
      <g transform="translate(4, 4) scale(0.833)">
        <path d="M35 13L24 21L13 13L17 24L24 30L31 24L35 13Z" fill="#E2761B" />
        <path d="M24 30L20 35L24 37L28 35L24 30Z" fill="#D7C1B3" />
        <path d="M17 24L13 13L16 27L20 35L24 30L17 24Z" fill="#E4761B" />
        <path d="M31 24L35 13L32 27L28 35L24 30L31 24Z" fill="#CD6116" />
      </g>
    </svg>
  );
}

/**
 * Official Google Multi-Color G Icon
 */
export function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M44.5 20H24V28.5H35.8C34.7 32.5 30.6 35.5 24 35.5C17.6 35.5 12.5 30.4 12.5 24C12.5 17.6 17.6 12.5 24 12.5C26.8 12.5 29.4 13.5 31.4 15.2L37.7 8.9C34 5.5 29.3 3.5 24 3.5C12.7 3.5 3.5 12.7 3.5 24C3.5 35.3 12.7 44.5 24 44.5C34.8 44.5 44 36.8 44 24C44 22.6 43.8 21.3 44.5 20Z"
        fill="#FFC107"
      />
      <path
        d="M5.3 14.7L12.5 20C14.3 15.6 18.8 12.5 24 12.5C26.8 12.5 29.4 13.5 31.4 15.2L37.7 8.9C34 5.5 29.3 3.5 24 3.5C15.8 3.5 8.7 8.2 5.3 14.7Z"
        fill="#FF3D00"
      />
      <path
        d="M24 44.5C29.2 44.5 33.9 42.6 37.5 39.4L30.6 33.9C28.7 35.2 26.5 36 24 36C17.5 36 12.4 31.6 10.6 25.8L3.4 31.3C6.7 39 14.7 44.5 24 44.5Z"
        fill="#4CAF50"
      />
      <path
        d="M44.5 20H24V28.5H35.8C35.2 30.8 33.7 32.7 31.6 34.1L38.5 39.6C42.4 36 44.8 30.5 44.8 24C44.8 22.6 44.7 21.3 44.5 20Z"
        fill="#1976D2"
      />
    </svg>
  );
}
