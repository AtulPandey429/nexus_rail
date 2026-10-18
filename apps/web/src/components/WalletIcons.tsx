import React from 'react';

export function FreighterIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#7D00FF" />
      <path
        d="M20 7L28 17L20 23L12 17L20 7Z"
        fill="white"
      />
      <path
        d="M12 17L20 23V33L12 25V17Z"
        fill="white"
        fillOpacity="0.8"
      />
      <path
        d="M28 17L20 23V33L28 25V17Z"
        fill="white"
        fillOpacity="0.6"
      />
    </svg>
  );
}

export function GemWalletIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0E232E" />
      <path
        d="M20 9L29 16L20 31L11 16L20 9Z"
        fill="#00E5A3"
      />
      <path
        d="M20 9L29 16H11L20 9Z"
        fill="#40FFB9"
      />
      <path
        d="M11 16L20 31V16H11Z"
        fill="#00C48C"
      />
      <path
        d="M29 16L20 31V16H29Z"
        fill="#00A878"
      />
    </svg>
  );
}

export function CrossmarkIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0C1929" />
      <path
        d="M12 12L20 20L28 12M12 28L20 20L28 28"
        stroke="#38BDF8"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="3" fill="#60A5FA" />
    </svg>
  );
}

export function XamanIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1C3F95" />
      <path
        d="M13 13H27L20 20L13 13Z"
        fill="white"
      />
      <path
        d="M13 27H27L20 20L13 27Z"
        fill="white"
        fillOpacity="0.85"
      />
      <circle cx="20" cy="20" r="2.5" fill="#38BDF8" />
    </svg>
  );
}

export function AlbedoIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0E1A2B" />
      <circle cx="20" cy="20" r="9" stroke="#38BDF8" strokeWidth="2.5" strokeDasharray="3 3" />
      <circle cx="20" cy="20" r="4.5" fill="#34D399" />
    </svg>
  );
}

export function MetaMaskIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#2E1805" />
      <path
        d="M29 11L20 18L11 11L14 20L20 25L26 20L29 11Z"
        fill="#E2761B"
      />
      <path
        d="M20 25L17 29L20 31L23 29L20 25Z"
        fill="#D7C1B3"
      />
      <path
        d="M14 20L11 11L13 23L17 29L20 25L14 20Z"
        fill="#E4761B"
      />
      <path
        d="M26 20L29 11L27 23L23 29L20 25L26 20Z"
        fill="#CD6116"
      />
    </svg>
  );
}
