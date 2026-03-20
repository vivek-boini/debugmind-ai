import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, RotateCcw, BrainCircuit, Calendar, Bell, MessageSquare,
  ExternalLink, Zap, Target, TrendingUp, CheckCircle2, ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from '../components/Modal';

export default function Landing() {
  const navigate = useNavigate();
  const { saveUser, analyze, loading } = useApp();
  const [url, setUrl] = useState('');
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [extractedUsername, setExtractedUsername] = useState('');

  // Extract and sanitize username from LeetCode URL or input
  const extractUsername = (input) => {
    if (!input) return '';

    // Sanitize: remove common URL parts
    let cleaned = input
      .replace(/https?:\/\//i, '')
      .replace(/leetcode\.com\/u\//i, '')
      .replace(/leetcode\.com\//i, '')
      .replace(/\/+$/, '')  // trailing slashes
      .replace(/\?.*$/, '') // query params
      .trim();

    // If still has slashes, take the last meaningful part
    if (cleaned.includes('/')) {
      const parts = cleaned.split('/').filter(Boolean);
      // Skip known non-username paths
      const excluded = ['problems', 'submissions', 'discuss', 'contest', 'explore', 'study'];
      cleaned = parts.find(p => !excluded.includes(p.toLowerCase())) || parts[0] || '';
    }

    // Final cleanup - only alphanumeric, underscore, hyphen
    cleaned = cleaned.replace(/[^a-zA-Z0-9_-]/g, '');

    console.log('[Landing] Extracted username:', cleaned, 'from input:', input);
    return cleaned.toLowerCase();
  };

  const handleStartAnalysis = async () => {
    const username = extractUsername(url);
    if (!username) {
      console.warn('[Landing] No valid username extracted from:', url);
      return;
    }

    console.log('[Landing] Starting analysis for:', username);
    setExtractedUsername(username);
    saveUser(username);
    setShowRedirectModal(true);
  };

  const handleConfirmRedirect = () => {
    // Redirect to user's LeetCode profile page (not submissions which 404s)
    const profileUrl = `https://leetcode.com/u/${extractedUsername}/`;
    console.log('[Landing] Redirecting to:', profileUrl);
    window.open(profileUrl, '_blank');
    setShowRedirectModal(false);
    // Navigate to dashboard where polling will wait for data
    navigate('/dashboard');
  };

  const handleSkipExtension = async () => {
    // Try direct API analysis (for demo/testing)
    setShowRedirectModal(false);
    try {
      await analyze(`https://leetcode.com/u/${extractedUsername}`);
      navigate('/dashboard');
    } catch (e) {
      // Navigate anyway - polling will handle it
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-accent-purple to-accent-teal flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-accent-purple/20">
              D
            </div>
            <span className="text-xl font-bold">DebugMind AI</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
          >
            View on GitHub <ExternalLink size={14} />
          </a>
        </header>

        {/* Main Hero */}
        <div className="text-center mb-16 animate-in fade-in duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-sm mb-8">
            <BrainCircuit size={16} />
            Agentic Learning System v2.1
          </div>

          <h1 className="text-4xl lg:text-6xl font-extrabold mb-6 bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight">
            Master Your Coding<br />Evolution
          </h1>

          <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto mb-12">
            DebugMind uses autonomous AI agents to analyze your LeetCode patterns, set personalized goals, and adapt strategies in real-time.
          </p>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-dark-800 border border-slate-700 rounded-2xl p-2 shadow-xl shadow-black/20">
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
                  placeholder="Enter LeetCode username or profile URL..."
                  className="flex-1 bg-transparent border-none focus:ring-0 p-4 text-lg placeholder:text-slate-600"
                />
                <button
                  onClick={handleStartAnalysis}
                  disabled={!url.trim() || loading}
                  className="btn-primary flex items-center justify-center gap-2 text-lg py-4 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Start Analysis
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Example: leetcode.com/u/username or just "username"
            </p>
          </div>
        </div>

        {/* Agent Loop Visualization */}
        <div className="mb-20">
          <h3 className="text-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">
            Agent Loop Architecture
          </h3>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['Extract', 'Diagnose', 'Set Goals', 'Plan', 'Monitor', 'Adapt'].map((stage, idx) => (
              <React.Fragment key={stage}>
                <div className="px-4 py-3 bg-dark-800 rounded-xl border border-slate-700 text-sm font-medium hover:border-accent-purple/50 hover:bg-dark-800/80 transition-all cursor-default">
                  <span className="text-accent-purple mr-2">{idx + 1}.</span>
                  {stage}
                </div>
                {idx < 5 && <ChevronRight size={18} className="text-slate-600" />}
              </React.Fragment>
            ))}
            <RotateCcw size={18} className="text-accent-purple ml-2 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            {
              icon: <MessageSquare size={28} />,
              title: 'Full Explainability',
              desc: 'Every agent decision is logged with human-readable explanations and confidence scores.'
            },
            {
              icon: <Calendar size={28} />,
              title: 'Adaptive Planning',
              desc: 'Dynamic learning paths that evolve based on your progress and performance trends.'
            },
            {
              icon: <Bell size={28} />,
              title: 'Smart Alerts',
              desc: 'Real-time notifications about your performance changes and strategy adaptations.'
            }
          ].map((feature, i) => (
            <div key={i} className="bg-dark-800 border border-slate-800 rounded-2xl p-8 hover:border-accent-purple/30 transition-colors group">
              <div className="w-14 h-14 bg-accent-purple/10 rounded-xl flex items-center justify-center text-accent-purple mb-6 group-hover:bg-accent-purple/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="font-bold text-lg mb-3">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="bg-dark-800 border border-slate-800 rounded-2xl p-8 lg:p-12 mb-20">
          <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: <Target size={24} />,
                title: 'Enter Username',
                desc: 'Provide your LeetCode username or profile URL to get started.'
              },
              {
                step: '2',
                icon: <Zap size={24} />,
                title: 'Extract via Extension',
                desc: 'Use our Chrome extension to securely extract your submission data.'
              },
              {
                step: '3',
                icon: <TrendingUp size={24} />,
                title: 'View AI Insights',
                desc: 'Get personalized analysis, goals, and adaptive learning plans.'
              }
            ].map((item, i) => (
              <div key={i} className="text-center relative">
                <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-linear-to-br from-accent-purple to-accent-teal flex items-center justify-center text-xl font-bold text-white">
                  {item.step}
                </div>
                <div className="w-12 h-12 mx-auto mb-4 bg-slate-800 rounded-xl flex items-center justify-center text-accent-teal">
                  {item.icon}
                </div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>

                {i < 2 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-slate-700" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-600 text-sm">
          <p>Built with AI for better coding • DebugMind AI 2026</p>
        </footer>
      </div>

      {/* Redirect Modal */}
      <Modal
        isOpen={showRedirectModal}
        onClose={() => setShowRedirectModal(false)}
        title="Ready to Extract Data"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-accent-purple/10 border border-accent-purple/20 rounded-xl p-4">
            <p className="text-sm">
              Logged in as: <span className="font-bold text-accent-purple">{extractedUsername}</span>
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-slate-300">
              You will be redirected to LeetCode. Please:
            </p>
            <ol className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-accent-teal shrink-0 mt-0.5" />
                <span>Open the <strong className="text-white">DebugMind Chrome Extension</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-accent-teal shrink-0 mt-0.5" />
                <span>Click <strong className="text-white">"Extract AI Data"</strong> button</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-accent-teal shrink-0 mt-0.5" />
                <span>Return here to view your personalized insights</span>
              </li>
            </ol>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={handleConfirmRedirect}
              className="btn-primary flex items-center justify-center gap-2"
            >
              Open LeetCode
              <ExternalLink size={18} />
            </button>
            <button
              onClick={handleSkipExtension}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip (use demo data)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
