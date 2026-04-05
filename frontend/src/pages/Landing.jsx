import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, RotateCcw, BrainCircuit, Calendar, Bell, MessageSquare,
  Zap, Target, TrendingUp, ChevronRight,
  LogIn, UserPlus, Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError('Please enter a valid LeetCode username or URL');
      return;
    }

    setLoading(true);
    setError('');
    console.log('[Landing] Checking user:', username);

    try {
      // Call backend to check if user exists
      const res = await fetch(`${API_BASE_URL}/check-user/${username}`);
      const data = await res.json();
      
      console.log('[Landing] Check user response:', data);

      if (data.exists) {
        // User exists - redirect to login with username
        console.log('[Landing] User exists, redirecting to login');
        navigate('/login', { state: { leetcodeUsername: username, hasData: data.hasData } });
      } else {
        // User doesn't exist - redirect to signup with username
        console.log('[Landing] New user, redirecting to signup');
        navigate('/signup', { state: { leetcodeUsername: username } });
      }
    } catch (err) {
      console.error('[Landing] Error checking user:', err);
      // On error, default to signup flow
      navigate('/signup', { state: { leetcodeUsername: username } });
    } finally {
      setLoading(false);
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
          
          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
              >
                Dashboard
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 py-2 px-4"
                >
                  <LogIn size={16} />
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
                >
                  <UserPlus size={16} />
                  Sign Up
                </Link>
              </>
            )}
          </div>
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
            <div className={`bg-dark-800 border rounded-2xl p-2 shadow-xl shadow-black/20 ${error ? 'border-red-500/50' : 'border-slate-700'}`}>
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleStartAnalysis()}
                  placeholder="Enter LeetCode username or profile URL..."
                  className="flex-1 bg-transparent border-none focus:ring-0 p-4 text-lg placeholder:text-slate-600"
                  disabled={loading}
                />
                <button
                  onClick={handleStartAnalysis}
                  disabled={!url.trim() || loading}
                  className="btn-primary flex items-center justify-center gap-2 text-lg py-4 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <p className="text-xs text-red-400 mt-3">{error}</p>
            ) : (
              <p className="text-xs text-slate-600 mt-3">
                Example: leetcode.com/u/username or just "username"
              </p>
            )}
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
    </div>
  );
}
