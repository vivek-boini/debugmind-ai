import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Target, ExternalLink, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, Badge, NextActionCard } from '../components/ui';

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

      {/* Problems Grid */}
      {problems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((p, i) => {
            const problem = typeof p === 'string' ? { title: p } : p;
            return (
              <Card key={i} className="flex flex-col h-full card-hover group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-accent-teal group-hover:bg-accent-teal group-hover:text-dark-900 transition-all">
                    <Target size={20} />
                  </div>
                  <Badge type={problem.difficulty === 'easy' ? 'success' : problem.difficulty === 'hard' ? 'danger' : 'warning'}>
                    {problem.difficulty || 'Medium'}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold mb-2">{problem.title || problem.lc_id || problem}</h3>
                <p className="text-sm text-slate-500 mb-8 flex-1">
                  {problem.topic ? `Focus: ${problem.topic}` : 'Practice patterns with this problem.'}
                </p>
                <a
                  href={problem.url || `https://leetcode.com/problems/${(problem.slug || problem.title || problem).toString().toLowerCase().replace(/\s+/g, '-')}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-slate-700 hover:bg-white hover:text-dark-900 font-bold text-xs transition-all uppercase tracking-widest"
                >
                  Solve on LeetCode <ExternalLink size={14} />
                </a>
              </Card>
            );
          })}
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
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {problems.filter(p => (typeof p === 'object' ? p.difficulty : 'medium') === 'easy').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Easy</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {problems.filter(p => (typeof p === 'object' ? p.difficulty : 'medium') === 'medium').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Medium</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400">
            {problems.filter(p => (typeof p === 'object' ? p.difficulty : 'medium') === 'hard').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Hard</div>
        </Card>
      </div>
    </div>
  );
}
