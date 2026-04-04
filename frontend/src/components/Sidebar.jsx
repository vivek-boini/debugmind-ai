import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Zap, BookOpen, TrendingUp, Settings, LogOut, Menu, X, Code2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/code-analysis', label: 'Code Analysis', icon: Code2 },
  { path: '/goals', label: 'Goals & Plan', icon: Target },
  { path: '/insights', label: 'Insights', icon: Zap },
  { path: '/recommendations', label: 'Recommendations', icon: BookOpen },
  { path: '/progress', label: 'Progress', icon: TrendingUp },
];

export function Sidebar({ isMobileOpen, onMobileClose }) {
  const navigate = useNavigate();
  const { hasData, logout } = useApp();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavClick = (path, e) => {
    if (!hasData && path !== '/dashboard') {
      e.preventDefault();
      return;
    }
    if (onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-64 bg-dark-800 border-r border-slate-800
        flex flex-col z-50 transition-transform duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-accent-purple to-accent-teal flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-accent-purple/20 group-hover:shadow-accent-purple/40 transition-shadow">
                D
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight">DebugMind</span>
                <span className="text-[10px] text-slate-500 block -mt-1">AI Learning Mentor</span>
              </div>
            </NavLink>

            {/* Mobile Close Button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = !hasData && item.path !== '/dashboard';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => handleNavClick(item.path, e)}
                className={({ isActive }) => `
                  sidebar-link w-full text-left relative group
                  ${isActive ? 'sidebar-link-active' : ''}
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                `}
              >
                <Icon size={20} />
                <span>{item.label}</span>

                {/* Disabled tooltip */}
                {isDisabled && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Run analysis first
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link w-full text-left ${isActive ? 'sidebar-link-active' : ''}`}
            onClick={onMobileClose}
          >
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>

          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-left text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>

        {/* Version Badge */}
        <div className="p-4 text-center">
          <span className="text-[10px] text-slate-600 font-mono">v2.1 • Agentic System</span>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-linear-to-br from-accent-purple to-accent-teal shadow-lg shadow-accent-purple/30 flex items-center justify-center"
    >
      <Menu size={24} className="text-white" />
    </button>
  );
}
