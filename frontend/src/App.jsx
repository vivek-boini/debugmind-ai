import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar, MobileMenuButton } from './components/Sidebar';

export default function App() {
  const { error, clearError } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-dark-900 text-slate-200 selection:bg-accent-purple/30">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar */}
        <Navbar />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>

        {/* Error Toast */}
        {error && (
          <div className="fixed bottom-6 right-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom shadow-2xl z-50 max-w-md">
            <AlertTriangle size={20} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={clearError}
              className="text-red-300 hover:text-white transition-colors text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="p-6 lg:p-8 border-t border-slate-800 text-center text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">
          DebugMind AI 2026 - Explainable Agentic Learning System v2.1
        </footer>
      </div>

      {/* Mobile Menu Button */}
      <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
    </div>
  );
}
