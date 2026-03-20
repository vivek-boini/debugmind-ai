import React from 'react';
import { RefreshCw, BrainCircuit } from 'lucide-react';

export function Loader({ text = 'Loading...', size = 'md' }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizes[size]} border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin`} />
      <p className="text-slate-400 text-sm animate-pulse">{text}</p>
    </div>
  );
}

export function FullPageLoader({ text = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full bg-accent-purple/20 animate-ping" />
          <div className="relative w-full h-full rounded-full bg-linear-to-br from-accent-purple to-accent-teal flex items-center justify-center">
            <BrainCircuit size={32} className="text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold mb-2">DebugMind AI</h2>
        <p className="text-slate-400 text-sm animate-pulse">{text}</p>
      </div>
    </div>
  );
}

export function WaitingForData() {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 mx-auto mb-8 relative">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-accent-teal border-t-transparent animate-spin" />
        <div className="absolute inset-3 rounded-full bg-dark-800 flex items-center justify-center">
          <RefreshCw size={24} className="text-accent-teal animate-spin" style={{ animationDuration: '3s' }} />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Waiting for Data from Extension...</h2>
      <p className="text-slate-400 mb-8 max-w-md mx-auto">
        Go to LeetCode → Click the Extension → Click "Extract AI Data" → Return here
      </p>

      <div className="bg-dark-800 border border-slate-700 rounded-xl p-6 text-left max-w-md mx-auto">
        <h3 className="font-bold mb-4 text-accent-teal">Quick Steps:</h3>
        <ol className="space-y-3 text-sm text-slate-400">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">1</span>
            <span>Go to your <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-accent-teal hover:underline">LeetCode profile page</a></span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">2</span>
            <span>Click the <strong className="text-white">DebugMind extension</strong> icon in your browser</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">3</span>
            <span>Click <strong className="text-white">"Extract AI Data"</strong> button</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
            <span>Data will appear here <strong className="text-white">automatically</strong></span>
          </li>
        </ol>
      </div>

      <div className="mt-8 p-4 bg-accent-purple/10 border border-accent-purple/20 rounded-lg max-w-md mx-auto">
        <p className="text-sm text-accent-purple">
          <span className="inline-block w-2 h-2 bg-accent-teal rounded-full animate-pulse mr-2"></span>
          Polling every 3 seconds for new data...
        </p>
      </div>

      <p className="text-xs text-slate-600 mt-4">
        Make sure the extension sends data with the same username you entered.
      </p>
    </div>
  );
}

export function EmptyState({ title, message, icon: Icon, action }) {
  return (
    <div className="text-center py-16 animate-in fade-in duration-500">
      {Icon && (
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-800 flex items-center justify-center">
          <Icon size={32} className="text-slate-500" />
        </div>
      )}
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">{message}</p>
      {action}
    </div>
  );
}
