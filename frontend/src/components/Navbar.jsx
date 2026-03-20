import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, Settings, LogOut, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';

export function Navbar() {
  const navigate = useNavigate();
  const { user, notifications, unreadCount, markNotificationRead, logout, data, agentState } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search functionality
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim() || !data) {
      setSearchResults([]);
      return;
    }

    const results = [];
    const q = query.toLowerCase();

    // Search weak topics
    data.weak_topics?.forEach(t => {
      if (t.topic.toLowerCase().includes(q)) {
        results.push({ type: 'topic', label: t.topic, link: '/dashboard' });
      }
    });

    // Search goals
    agentState?.goals?.forEach(g => {
      if (g.topic.toLowerCase().includes(q)) {
        results.push({ type: 'goal', label: `Goal: ${g.topic}`, link: '/goals' });
      }
    });

    // Search recommended problems
    data.recommended_problems?.forEach(p => {
      const title = typeof p === 'string' ? p : p.title;
      if (title?.toLowerCase().includes(q)) {
        results.push({ type: 'problem', label: title, link: '/recommendations' });
      }
    });

    setSearchResults(results.slice(0, 5));
    setShowSearch(results.length > 0);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const notificationIcons = {
    success: <Check size={14} className="text-emerald-400" />,
    warning: <Bell size={14} className="text-amber-400" />,
    error: <X size={14} className="text-red-400" />,
    info: <Bell size={14} className="text-blue-400" />
  };

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-dark-900/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
        {/* Search */}
        <div className="relative w-72 lg:w-96 hidden md:block" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowSearch(true)}
            placeholder="Search topics, goals, problems..."
            className="w-full bg-dark-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-purple/50 transition-colors"
          />

          {/* Search Results Dropdown */}
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-dark-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    navigate(result.link);
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-700/50 flex items-center gap-3 text-sm border-b border-slate-800 last:border-0"
                >
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    result.type === 'topic' ? 'bg-accent-purple/20 text-accent-purple' :
                    result.type === 'goal' ? 'bg-accent-teal/20 text-accent-teal' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {result.type}
                  </span>
                  <span>{result.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 lg:gap-4 ml-auto">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-teal rounded-full text-[10px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-dark-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="font-bold">Notifications</h3>
                  <span className="text-xs text-slate-500">{notifications.length} total</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`w-full p-4 text-left hover:bg-slate-700/30 flex items-start gap-3 border-b border-slate-800 last:border-0 ${
                          !notif.read ? 'bg-slate-800/50' : ''
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {notificationIcons[notif.type] || notificationIcons.info}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notif.read ? 'font-medium' : 'text-slate-400'}`}>
                            {notif.message}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-accent-teal shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings size={20} />
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 pl-4 border-l border-slate-800 text-sm font-medium hover:bg-slate-800/50 rounded-lg p-2 transition-colors"
            >
              <span className="text-slate-400 hidden sm:inline">
                Hello, <span className="text-white">{user || 'Developer'}</span>
              </span>
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-accent-purple to-accent-teal flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-dark-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <p className="font-bold truncate">{user || 'Developer'}</p>
                  <p className="text-xs text-slate-500">LeetCode User</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setShowSettings(true); }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-700/50 flex items-center gap-3 text-sm"
                >
                  <Settings size={16} className="text-slate-400" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left hover:bg-red-500/10 flex items-center gap-3 text-sm text-red-400"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Settings" size="md">
        <div className="space-y-6">
          <div>
            <h4 className="font-bold mb-3">Preferences</h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <span className="text-sm">Enable notifications</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent-purple" />
              </label>
              <label className="flex items-center justify-between p-3 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <span className="text-sm">Auto-refresh data</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent-purple" />
              </label>
              <label className="flex items-center justify-between p-3 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <span className="text-sm">Show agent decisions</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent-purple" />
              </label>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-3">Account</h4>
            <div className="p-4 bg-dark-900 rounded-lg">
              <p className="text-sm text-slate-400 mb-2">Logged in as:</p>
              <p className="font-bold">{user || 'Not logged in'}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={() => { setShowSettings(false); handleLogout(); }}
              className="w-full py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
