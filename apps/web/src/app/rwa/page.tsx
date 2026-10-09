'use client';

import React from 'react';
import Link from 'next/link';
import { RwaGoldVaultCard } from '@/components/RwaGoldVaultCard';

export default function RwaVaultOverviewPage() {
  return (
    <div className="space-y-6">
      <RwaGoldVaultCard />
    </div>
  );
}
