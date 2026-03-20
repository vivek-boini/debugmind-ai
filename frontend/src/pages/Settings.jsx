import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Bell, Shield, Palette, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useApp();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-slate-400">Manage your preferences</p>
        </div>
      </div>

      {/* Account Section */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-purple/20 flex items-center justify-center">
            <User size={20} className="text-accent-purple" />
          </div>
          <h3 className="font-bold">Account</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
            <div>
              <p className="font-medium">LeetCode Username</p>
              <p className="text-sm text-slate-400">{user || 'Not connected'}</p>
            </div>
            <button className="px-4 py-2 text-sm border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              Change
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
            <div>
              <p className="font-medium">Data Storage</p>
              <p className="text-sm text-slate-400">Analysis data stored locally</p>
            </div>
            <button className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors">
              Clear Data
            </button>
          </div>
        </div>
      </Card>

      {/* Notifications Section */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-teal/20 flex items-center justify-center">
            <Bell size={20} className="text-accent-teal" />
          </div>
          <h3 className="font-bold">Notifications</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Strategy Updates</p>
              <p className="text-sm text-slate-400">Get notified when AI adapts your strategy</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-accent-purple" />
          </label>

          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Goal Reminders</p>
              <p className="text-sm text-slate-400">Remind me about daily learning goals</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-accent-purple" />
          </label>

          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Progress Alerts</p>
              <p className="text-sm text-slate-400">Notify when performance changes significantly</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-accent-purple" />
          </label>
        </div>
      </Card>

      {/* Appearance Section */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Palette size={20} className="text-amber-400" />
          </div>
          <h3 className="font-bold">Appearance</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Dark Theme</p>
              <p className="text-sm text-slate-400">Use dark color scheme</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-accent-purple" />
          </label>

          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Compact View</p>
              <p className="text-sm text-slate-400">Reduce spacing in dashboard</p>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-accent-purple" />
          </label>
        </div>
      </Card>

      {/* Privacy Section */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <h3 className="font-bold">Privacy & Data</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Auto Polling</p>
              <p className="text-sm text-slate-400">Automatically check for new data</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-accent-purple" />
          </label>

          <label className="flex items-center justify-between p-4 bg-dark-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-medium">Store Analysis History</p>
              <p className="text-sm text-slate-400">Keep historical analysis data</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-accent-purple" />
          </label>
        </div>
      </Card>

      {/* Logout */}
      <Card className="border-red-500/20">
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-lg bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
        >
          Logout
        </button>
        <p className="text-xs text-slate-500 text-center mt-3">
          This will clear your session and return you to the homepage.
        </p>
      </Card>
    </div>
  );
}
