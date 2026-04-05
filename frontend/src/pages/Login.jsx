import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, Loader2, BrainCircuit, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, authError } = useApp();
  
  // Get username passed from landing page
  const passedUsername = location.state?.leetcodeUsername || '';
  const hasStoredData = location.state?.hasData || false;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await login(email.trim(), password);
      
      if (result.success) {
        // Login successful - navigate to dashboard
        navigate('/dashboard');
      } else {
        setLocalError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setLocalError('An unexpected error occurred. Please try again.');
      console.error('[Login] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-accent-purple to-accent-teal flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-accent-purple/20">
            D
          </div>
          <span className="text-xl font-bold">DebugMind AI</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-dark-800 border border-slate-700 rounded-2xl p-8 shadow-xl shadow-black/20">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-accent-purple/10 flex items-center justify-center">
              <BrainCircuit size={32} className="text-accent-purple" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
            <p className="text-slate-400 text-center text-sm mb-6">
              Sign in to continue to your dashboard
            </p>

            {/* Username Badge (if coming from landing) */}
            {passedUsername && (
              <div className="mb-6 p-3 bg-accent-teal/10 border border-accent-teal/20 rounded-xl flex items-center gap-3">
                <User size={18} className="text-accent-teal" />
                <div>
                  <p className="text-sm text-slate-300">
                    Account found for: <span className="font-bold text-accent-teal">{passedUsername}</span>
                  </p>
                  {hasStoredData && (
                    <p className="text-xs text-slate-500 mt-1">Your analysis data is ready!</p>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {displayError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{displayError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-dark-700 border border-slate-600 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-colors"
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-dark-700 border border-slate-600 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-colors"
                    disabled={isSubmitting}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || !password}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-500 text-sm">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link 
                to="/signup" 
                className="text-accent-purple hover:text-accent-teal transition-colors font-medium"
              >
                Create one
              </Link>
            </p>
          </div>

          {/* Guest Login Option */}
          <div className="mt-6 text-center">
            <Link 
              to="/"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Continue as guest
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
