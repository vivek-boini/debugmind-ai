import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Target, ExternalLink, ArrowRight, Lightbulb, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, Badge, NextActionCard } from '../components/ui';

// Enhanced problem card with reason
const ProblemCard = ({ problem, index }) => {
  const p = typeof problem === 'string' ? { title: problem } : problem;
  
  const difficultyConfig = {
    easy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    hard: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  };
  
  const config = difficultyConfig[p.difficulty] || difficultyConfig.medium;

  return (
    <Card className={`flex flex-col h-full card-hover group border-l-4 ${config.border}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-accent-teal group-hover:bg-accent-teal group-hover:text-dark-900 transition-all">
          <Target size={20} />
        </div>
        <div className="flex items-center gap-2">
          <Badge type={p.difficulty === 'easy' ? 'success' : p.difficulty === 'hard' ? 'danger' : 'warning'}>
            {p.difficulty || 'Medium'}
          </Badge>
          {p.priority && (
            <Badge type="info" className="text-[10px]">#{index + 1}</Badge>
          )}
        </div>
      </div>

      <h3 className="text-lg font-bold mb-2">{p.title || p.lc_id || p}</h3>
      
      {/* Topic/Focus */}
      {p.topic && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
          <BookOpen size={12} />
          <span>{p.topic}</span>
        </div>
      )}

      {/* Pattern/Focus info */}
      {(p.pattern || p.focus) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {p.pattern && (
            <span className="text-[10px] px-2 py-0.5 bg-accent-purple/10 text-accent-purple rounded">
              {p.pattern}
            </span>
          )}
          {p.focus && (
            <span className="text-[10px] px-2 py-0.5 bg-accent-teal/10 text-accent-teal rounded">
              {p.focus}
            </span>
          )}
        </div>
      )}

      {/* REASON - Most important */}
      {p.reason && (
        <div className="flex-1 p-3 bg-accent-purple/5 rounded-lg border border-accent-purple/20 mb-4">
          <div className="flex items-center gap-1 text-xs text-accent-purple font-semibold mb-1">
            <Lightbulb size={12} />
            Why this problem?
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{p.reason}</p>
        </div>
      )}

      {/* Default reason if none provided */}
      {!p.reason && p.topic && (
        <p className="text-sm text-slate-500 mb-4 flex-1 italic">
          Recommended to strengthen your {p.topic} skills
        </p>
      )}

      {!p.reason && !p.topic && (
        <p className="text-sm text-slate-500 mb-4 flex-1">
          Practice patterns with this problem.
        </p>
      )}

      <a
        href={p.url || `https://leetcode.com/problems/${(p.slug || p.title || p).toString().toLowerCase().replace(/\s+/g, '-')}/`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-slate-700 hover:bg-white hover:text-dark-900 font-bold text-xs transition-all uppercase tracking-widest"
      >
        Solve on LeetCode <ExternalLink size={14} />
      </a>
    </Card>
  );
};

// Personalization info section
const PersonalizationInfo = ({ plan }) => {
  if (!plan?.personalization || plan.personalization.length === 0) return null;

  return (
    <Card className="p-4 bg-linear-to-r from-accent-teal/5 to-transparent border-accent-teal/20 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-accent-teal" />
        <h3 className="font-semibold text-sm">Why These Problems?</h3>
      </div>
      <ul className="space-y-2">
        {plan.personalization.slice(0, 4).map((note, idx) => (
          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
            <span className="text-accent-teal">•</span>
            {note}
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default function Recommendations() {
  const navigate = useNavigate();
  const { user, data, hasData, agentState } = useApp();

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  if (!hasData) {
    return (
      <EmptyState
        title="No Recommendations Yet"
        message="Complete an analysis to get personalized problem recommendations."
        icon={BookOpen}
        action={
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Start Analysis <ArrowRight size={18} />
          </Link>
        }
      />
    );
  }

  // Get problems from today's plan or recommended problems
  const todaysPlan = agentState?.plan?.plan?.filter(p => p.day === (agentState?.plan?.current_day || 1)) || [];
  const problems = todaysPlan.flatMap(p => p.problems || []).length > 0
    ? todaysPlan.flatMap(p => p.problems || [])
    : data.recommended_problems || [];

  // Get adaptation recommendations
  const adaptationRecs = agentState?.adaptation?.recommendations || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Practice Strategy</h2>
          <p className="text-slate-400">Problems selected by the planning agent</p>
        </div>
        <Badge type="info">{problems.length} problems</Badge>
      </div>

      {/* Next Action Card */}
      {agentState?.next_action && <NextActionCard nextAction={agentState.next_action} />}

      {/* Personalization Info */}
      <PersonalizationInfo plan={agentState?.plan} />

      {/* Adaptation Recommendations */}
      {adaptationRecs.length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <h3 className="font-semibold text-sm">Adaptive Suggestions</h3>
          </div>
          <div className="space-y-2">
            {adaptationRecs.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 ${
                  rec.priority === 'high' ? 'text-red-400' :
                  rec.priority === 'medium' ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {rec.priority === 'high' ? '⚠️' : rec.priority === 'medium' ? '💡' : '→'}
                </span>
                <div>
                  <span className="text-slate-300">{rec.text}</span>
                  {rec.action && (
                    <span className="text-accent-teal ml-2">• {rec.action}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Problems Grid */}
      {problems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((p, i) => (
            <ProblemCard key={i} problem={p} index={i} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Target size={48} className="mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-bold mb-2">No Problems Assigned</h3>
          <p className="text-slate-400">Your learning plan will be populated once the agent completes analysis.</p>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center bg-linear-to-br from-emerald-500/10 to-transparent">
          <div className="text-2xl font-bold text-emerald-400">
            {problems.filter(p => (typeof p === 'object' ? p.difficulty : 'medium') === 'easy').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Easy</div>
        </Card>
        <Card className="p-4 text-center bg-linear-to-br from-amber-500/10 to-transparent">
          <div className="text-2xl font-bold text-amber-400">
            {problems.filter(p => (typeof p === 'object' ? p.difficulty : 'medium') === 'medium').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Medium</div>
        </Card>
        <Card className="p-4 text-center bg-linear-to-br from-red-500/10 to-transparent">
          <div className="text-2xl font-bold text-red-400">
            {problems.filter(p => (typeof p === 'object' ? p.difficulty : 'medium') === 'hard').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Hard</div>
        </Card>
      </div>

      {/* Today's Focus Summary */}
      {todaysPlan.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-accent-purple" />
            Today's Focus Areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {todaysPlan.map((item, idx) => (
              <div key={idx} className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm">
                <span className="font-medium">{item.focus}</span>
                {item.objective && (
                  <span className="text-slate-400 ml-2">• {item.objective}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
