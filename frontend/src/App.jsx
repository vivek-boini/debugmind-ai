import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Zap, 
  Target, 
  TrendingUp, 
  Settings, 
  LogOut, 
  Search,
  Bell,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  BrainCircuit,
  BarChart3
} from 'lucide-react';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// --- Reusable UI Components ---

const Card = ({ children, className = "" }) => (
  <div className={`card ${className}`}>{children}</div>
);

const Badge = ({ children, type = "neutral", className = "" }) => {
  const styles = {
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    info: "bg-accent-purple/10 text-accent-purple/80 border-accent-purple/20"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[type]} ${className}`}>
      {children}
    </span>
  );
};

const ProgressBar = ({ value, color = "accent-purple" }) => (
  <div className="w-full">
    <div className="flex justify-between mb-1.5">
      <span className="text-xs font-medium text-slate-400">{value}%</span>
    </div>
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ 
          width: `${value}%`, 
          backgroundColor: color === 'accent-purple' ? 'var(--color-accent-purple)' : color 
        }}
      />
    </div>
  </div>
);

// --- Layout Components ---

const Sidebar = ({ currentView, setView, hasData }) => (
  <aside className="w-64 bg-dark-800 border-r border-slate-800 hidden lg:flex flex-col h-screen sticky top-0">
    <div className="p-6">
      <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => setView('dashboard')}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-teal flex items-center justify-center font-bold text-lg">D</div>
        <span className="text-xl font-bold tracking-tight">DebugMind</span>
      </div>
      
      <nav className="space-y-1">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { id: 'insights', label: 'Insights', icon: <Zap size={20} /> },
          { id: 'recommendations', label: 'Recommendations', icon: <Target size={20} /> },
          { id: 'progress', label: 'Progress', icon: <TrendingUp size={20} /> }
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setView(item.id)}
            disabled={!hasData && item.id !== 'dashboard'}
            className={`sidebar-link w-full text-left disabled:opacity-30 disabled:cursor-not-allowed ${currentView === item.id ? 'sidebar-link-active' : ''}`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
    </div>
    
    <div className="mt-auto p-6 border-t border-slate-800 space-y-1">
      <button className="sidebar-link w-full text-left"><Settings size={20} /> Settings</button>
      <button className="sidebar-link w-full text-left text-red-400 hover:bg-red-500/5 hover:text-red-400"><LogOut size={20} /> Logout</button>
    </div>
  </aside>
);

const Navbar = ({ user }) => (
  <header className="h-16 border-b border-slate-800 bg-dark-900/50 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
    <div className="relative w-96 hidden md:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
      <input 
        type="text" 
        placeholder="Search analysis..." 
        className="w-full bg-dark-800 border border-slate-700 rounded-lg py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-purple/50 transition-colors"
      />
    </div>
    
    <div className="flex items-center gap-4">
      <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
        <Bell size={20} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-accent-teal rounded-full"></span>
      </button>
      <div className="flex items-center gap-3 pl-4 border-l border-slate-800 text-sm font-medium">
        <span className="text-slate-400 hidden sm:inline">Hello, <span className="text-white">{user || 'Developer'}</span></span>
        <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden">
          <User size={18} className="text-slate-400" />
        </div>
      </div>
    </div>
  </header>
);

// --- View Components ---

const WelcomeHero = ({ onAnalyze, loading, url, setUrl }) => (
  <div className="max-w-4xl mx-auto py-20 px-4 animate-in fade-in duration-700">
    <div className="text-center mb-12">
      <Badge type="info">New: Agentic Reasoning v2.0</Badge>
      <h1 className="text-5xl font-extrabold mt-6 mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
        Master Your Coding Evolution
      </h1>
      <p className="text-lg text-slate-400 max-w-2xl mx-auto">
        DebugMind analyzes your LeetCode patterns to detect conceptual gaps and provides adaptive learning strategies powered by AI.
      </p>
    </div>
    
    <Card className="p-2 bg-slate-800/50">
      <div className="flex flex-col md:flex-row gap-2">
        <input 
          type="text" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste your LeetCode Profile URL..." 
          className="flex-1 bg-transparent border-none focus:ring-0 p-4 text-lg"
        />
        <button 
          onClick={onAnalyze}
          disabled={loading}
          className="btn-primary flex items-center justify-center gap-2 text-lg py-4 px-8"
        >
          {loading ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
          ) : (
            <>Analyze Profile <ArrowRight size={20} /></>
          )}
        </button>
      </div>
    </Card>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-center text-slate-400">
      {[
        { title: 'Detect Gaps', icon: <AlertTriangle size={24} />, desc: 'Find logical blindspots in your code patterns.', color: 'accent-purple' },
        { title: 'Adaptive Goals', icon: <Target size={24} />, desc: 'Personalized mastery goals based on your evolution.', color: 'accent-teal' },
        { title: 'Progress Agent', icon: <Clock size={24} />, desc: 'Autonomous monitoring that adapts as you solve.', color: 'blue-400' }
      ].map((f, i) => (
        <div key={i}>
          <div className={`w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4`}>{f.icon}</div>
          <h3 className="font-semibold mb-2 text-white">{f.title}</h3>
          <p className="text-sm">{f.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

const DashboardView = ({ data }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.weak_topics.map((t, i) => (
            <Card key={i} className="card-hover border-l-4 border-l-accent-purple">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg">{t.topic}</h3>
                <Badge type="warning">{t.confidence}%</Badge>
              </div>
              <ProgressBar value={t.confidence} />
              <p className="text-sm text-slate-400 mt-4 line-clamp-2 italic">Goal: {t.goal}</p>
            </Card>
          ))}
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold">Topic Accuracy Breakdown</h3>
            <button className="text-xs text-accent-teal font-bold hover:underline">View All</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-800/30 text-xs text-slate-500 uppercase font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4">Topic</th>
                <th className="px-6 py-4">Patterns</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.weak_topics.map((t, i) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors text-sm">
                  <td className="px-6 py-4 font-medium">{t.topic}</td>
                  <td className="px-6 py-4 text-slate-400">{t.evidence.length} detected</td>
                  <td className="px-6 py-4 text-right"><Badge type="danger">Critical</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="space-y-8">
        <Card>
          <h3 className="font-bold mb-4 flex items-center gap-2 text-accent-teal"><TrendingUp size={18} /> Skill Heatmap</h3>
          <div className="space-y-5">
            {[
              { label: 'Arrays', val: 82, color: '#4ad9c8' },
              { label: 'Strings', val: 75, color: '#4ad9c8' },
              { label: 'DP', val: 34, color: '#ef4444' },
              { label: 'Graphs', val: 51, color: '#6b5cff' }
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-[10px] mb-1.5 uppercase font-bold text-slate-500 tracking-widest">
                  <span>{s.label}</span><span>{s.val}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-1000" style={{ width: `${s.val}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-accent-purple/10 to-transparent border-accent-purple/20">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-accent-purple"><BrainCircuit size={18} /> Agent Summary</h3>
          <p className="text-sm text-slate-400 leading-relaxed italic">
            "Your code evolution suggests consistent bottlenecks in {data.weak_topics[0].topic.toLowerCase()}. Consider focusing on boundary condition validation in your next sessions."
          </p>
        </Card>
      </div>
    </div>
  </div>
);

const InsightsView = ({ data }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-end">
      <div>
        <h2 className="text-2xl font-bold">Conceptual Insights</h2>
        <p className="text-slate-400">Deep-dive into identified code patterns</p>
      </div>
      <Badge type="info">Dynamic Analysis</Badge>
    </div>
    <div className="grid grid-cols-1 gap-6">
      {data.weak_topics.map((t, i) => (
        <Card key={i} className="relative overflow-hidden group">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 border-r border-slate-800 pr-8">
              <Badge type="danger" className="mb-4">Pattern Alert</Badge>
              <h3 className="text-xl font-bold mb-2">{t.topic}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">{t.strategy}</p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{t.confidence}%</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Confidence</div>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{t.evidence.length}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Instances</div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Empirical Evidence</h4>
              <div className="space-y-3">
                {t.evidence.map((e, idx) => (
                  <div key={idx} className="p-4 bg-dark-900/50 rounded-lg border border-slate-800 flex gap-4 items-start">
                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-300 font-medium">{e}</p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">Detected in recent submissions</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

const RecommendationsView = ({ data }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-end">
      <div>
        <h2 className="text-2xl font-bold">Practice Strategy</h2>
        <p className="text-slate-400">Targeted problems to build muscle memory</p>
      </div>
      <button className="btn-primary py-2 text-sm">Start Practice Session</button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.recommended_problems.map((p, i) => (
        <Card key={i} className="flex flex-col h-full card-hover group">
          <div className="flex justify-between items-start mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-accent-teal transition-all group-hover:bg-accent-teal group-hover:text-dark-900"><Target size={20} /></div>
            <Badge type={i % 2 === 0 ? "info" : "warning"}>{i % 2 === 0 ? 'Medium' : 'Hard'}</Badge>
          </div>
          <h3 className="text-lg font-bold mb-2">{p}</h3>
          <p className="text-sm text-slate-500 mb-8 flex-1">Apply identified {data.weak_topics[0].topic.toLowerCase()} optimizations to solve this efficiently.</p>
          <a href={`https://leetcode.com/problems/${p.toLowerCase().replace(/ /g, '-')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-slate-700 hover:bg-white hover:text-dark-900 font-bold text-xs transition-all uppercase tracking-widest">
            Solve on LeetCode <ExternalLink size={14} />
          </a>
        </Card>
      ))}
    </div>
  </div>
);

const ProgressView = ({ data }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div><h2 className="text-2xl font-bold">Learning Evolution</h2><p className="text-slate-400">Tracking your mastery over time</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Card className="lg:col-span-3 h-64 flex flex-col justify-center items-center text-slate-600 border-dashed"><BarChart3 size={48} className="mb-4 opacity-20" /><p className="font-medium">Mastery Trend Visualization</p></Card>
      <div className="space-y-6">
        <Card className="p-4"><div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Analysed</div><div className="text-3xl font-bold text-white">11</div></Card>
        <Card className="p-4"><div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Concepts Mastery</div><div className="text-3xl font-bold text-white">63%</div></Card>
      </div>
    </div>
    <section>
      <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-300"><Clock size={18} /> Agent Timeline</h3>
      <div className="space-y-0 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {[
          { title: 'Analysis Successful', desc: `11 submissions analyzed for ${data.user}`, icon: <CheckCircle2 size={14} />, color: 'emerald-500' },
          { title: 'Pattern Detected', desc: `Identified logic bottlenecks in ${data.weak_topics[0].topic}`, icon: <Zap size={14} />, color: 'accent-purple' },
          { title: 'Goal Set', desc: data.weak_topics[0].goal, icon: <Target size={14} />, color: 'accent-teal' }
        ].map((item, i) => (
          <div key={i} className="flex gap-6 pb-8 relative group">
            <div className={`w-9 h-9 rounded-full bg-dark-900 border-2 border-slate-800 flex items-center justify-center z-10`}><div style={{ color: item.color }}>{item.icon}</div></div>
            <div>
              <h4 className="font-bold text-sm text-white">{item.title}</h4>
              <p className="text-sm text-slate-400 mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

// --- Root Component ---

export default function App() {
  const [url, setUrl] = useState('https://leetcode.com/u/vivek_boini');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl: url })
      });
      if (!res.ok) throw new Error('System could not reach the analysis engine.');
      const json = await res.json();
      setData(json);
      setView('dashboard');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderView = () => {
    if (!data) return <WelcomeHero url={url} setUrl={setUrl} loading={loading} onAnalyze={analyze} />;
    switch (view) {
      case 'insights': return <InsightsView data={data} />;
      case 'recommendations': return <RecommendationsView data={data} />;
      case 'progress': return <ProgressView data={data} />;
      default: return <DashboardView data={data} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-900 text-slate-200 selection:bg-accent-purple/30">
      <Sidebar currentView={view} setView={setView} hasData={!!data} />
      <div className="flex-1 flex flex-col">
        <Navbar user={data?.user} />
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {renderView()}
        </main>
        {error && (
          <div className="fixed bottom-6 right-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom shadow-2xl z-50">
            <AlertTriangle size={20} /> {error}
          </div>
        )}
        <footer className="p-8 border-t border-slate-800 text-center text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">
          DebugMind AI © 2026 • Adaptive Agentic Reasoning Engine
        </footer>
      </div>
    </div>
  );
}
