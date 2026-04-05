import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, AlertCircle, Loader2, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, isAuthenticated, authError } = useApp();
  
  // Get username passed from landing page
  const passedUsername = location.state?.leetcodeUsername || '';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [leetcodeUsername, setLeetcodeUsername] = useState(passedUsername);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Update leetcode username if passed from landing
  useEffect(() => {
    if (passedUsername) {
      setLeetcodeUsername(passedUsername);
    }
  }, [passedUsername]);

  // Validate form
  const validateForm = () => {
    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }
    if (!email.includes('@')) {
      setLocalError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setLocalError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }
    if (!leetcodeUsername.trim()) {
      setLocalError('LeetCode username is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await signup(email.trim(), password, leetcodeUsername.trim());
      
      if (result.success) {
        // Signup successful - navigate to dashboard
        // The AppContext will handle setting up the user
        navigate('/dashboard');
      } else {
        setLocalError(result.error || 'Signup failed. Please try again.');
      }
    } catch (err) {
      setLocalError('An unexpected error occurred. Please try again.');
      console.error('[Signup] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '' };
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-accent-teal'];
    
    return { strength, label: labels[strength], color: colors[strength] };
  };

  const passwordStrength = getPasswordStrength();

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
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-dark-800 border border-slate-700 rounded-2xl p-8 shadow-xl shadow-black/20">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-accent-teal/10 flex items-center justify-center">
              <BrainCircuit size={32} className="text-accent-teal" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
            <p className="text-slate-400 text-center text-sm mb-8">
              Start your personalized coding journey
            </p>

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

              {/* LeetCode Username Field */}
              <div>
                <label htmlFor="leetcode" className="block text-sm font-medium text-slate-300 mb-2">
                  LeetCode Username
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="leetcode"
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    placeholder="your_leetcode_username"
                    className="w-full bg-dark-700 border border-slate-600 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-colors"
                    disabled={isSubmitting}
                    autoComplete="username"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Used to link your LeetCode submissions
                </p>
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
                    autoComplete="new-password"
                  />
                </div>
                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-dark-600 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{passwordStrength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-dark-700 border border-slate-600 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-colors"
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
                {/* Match Indicator */}
                {confirmPassword && (
                  <div className="mt-2 flex items-center gap-2">
                    {password === confirmPassword ? (
                      <>
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="text-xs text-green-500">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} className="text-red-400" />
                        <span className="text-xs text-red-400">Passwords don't match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    Create Account
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

            {/* Login Link */}
            <p className="text-center text-slate-400 text-sm">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-accent-purple hover:text-accent-teal transition-colors font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Guest Option */}
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
