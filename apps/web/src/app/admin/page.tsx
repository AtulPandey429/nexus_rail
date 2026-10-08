'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Package, ShoppingCart, Users, ArrowRight, ShieldAlert, BarChart2 } from 'lucide-react';

export default function AdminDashboardOverview() {
  return (
    <div className="min-h-screen bg-nexus-dark text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner */}
        <div className="p-3 rounded-xl bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple text-xs font-mono flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>NexusRail Operator Admin Desk • Restricted Access (role: admin)</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Operator Admin Dashboard</h1>
            <p className="text-gray-400 text-sm font-mono mt-1">Logged in as admin@nexusrail.dev</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/orders"
              className="px-4 py-2 rounded-xl bg-rail-emerald/20 border border-rail-emerald/50 text-rail-emerald hover:bg-rail-emerald/30 text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Fulfillment Manager</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="text-xs text-gray-400 font-mono">Test Mode Volume</div>
            <div className="text-2xl font-bold text-rail-emerald mt-2">$66.00 USD</div>
          </div>
          <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="text-xs text-gray-400 font-mono">Total Orders</div>
            <div className="text-2xl font-bold text-white mt-2">2 Orders</div>
          </div>
          <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="text-xs text-gray-400 font-mono">Active Products</div>
            <div className="text-2xl font-bold text-stellar-cyan mt-2">3 SKUs</div>
          </div>
          <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800">
            <div className="text-xs text-gray-400 font-mono">Users Registered</div>
            <div className="text-2xl font-bold text-cyber-purple mt-2">2 Users</div>
          </div>
        </div>

        {/* Admin Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Link href="/admin/orders" className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-rail-emerald transition-all group space-y-4">
            <div className="flex justify-between items-center text-rail-emerald">
              <ShoppingCart className="w-6 h-6" />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Order Fulfillment</h3>
              <p className="text-xs text-gray-400 mt-1">Manage order statuses (PAID → FULFILLING → FULFILLED).</p>
            </div>
          </Link>

          <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 opacity-90 space-y-4">
            <div className="flex justify-between items-center text-stellar-cyan">
              <Package className="w-6 h-6" />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stellar-cyan/10 border border-stellar-cyan/20">3 ACTIVE</span>
            </div>
            <div>
              <h3 className="text-lg font-bold">Product Catalog</h3>
              <p className="text-xs text-gray-400 mt-1">Manage SKUs, descriptions, pricing, and stock quantities.</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 opacity-90 space-y-4">
            <div className="flex justify-between items-center text-cyber-purple">
              <Users className="w-6 h-6" />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-purple/10 border border-cyber-purple/20">PROTECTED</span>
            </div>
            <div>
              <h3 className="text-lg font-bold">User Roles</h3>
              <p className="text-xs text-gray-400 mt-1">Manage user permissions and operator role assignments.</p>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <Link href="/" className="text-xs font-mono text-gray-400 hover:text-white transition-colors">
            ← Return to Home Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
