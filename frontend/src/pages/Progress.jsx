import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Clock, Activity, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, ConfidenceChart, StrategyEvolution } from '../components/ui';

export default function Progress() {
  const navigate = useNavigate();
  const { user, data, hasData, agentState } = useApp();

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  if (!hasData) {
    return (
      <EmptyState
        title="No Progress Data"
        message="Complete an analysis to start tracking your learning progress."
        icon={TrendingUp}
        action={
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Start Analysis <ArrowRight size={18} />
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">Learning Evolution</h2>
        <p className="text-slate-400">Tracking your mastery over time</p>
      </div>

      {/* Main Chart and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <ConfidenceChart
            chartData={agentState?.confidence_history?.chart_data}
            overallTrend={agentState?.confidence_history?.overall_trend}
          />
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Submissions</div>
            <div className="text-3xl font-bold">{agentState?.metrics?.total_submissions || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Success Rate</div>
            <div className="text-3xl font-bold text-emerald-400">
              {agentState?.metrics?.total_submissions
                ? Math.round((agentState.metrics.total_accepted / agentState.metrics.total_submissions) * 100)
                : 0}%
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Agent Loops</div>
            <div className="text-3xl font-bold text-accent-purple">{agentState?.agent_loop?.total_runs || 0}</div>
          </Card>
        </div>
      </div>

      {/* Strategy Evolution */}
      {agentState?.strategy_evolution && (
        <StrategyEvolution evolution={agentState.strategy_evolution} />
      )}

      {/* Activity Timeline */}
      <section>
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Clock size={18} /> Activity Timeline
        </h3>
        <div className="space-y-0 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {(agentState?.agent_loop?.stage_history || []).slice(-8).reverse().map((item, i) => (
            <div key={i} className="flex gap-6 pb-6 relative">
              <div className="w-8 h-8 rounded-full bg-dark-900 border-2 border-slate-800 flex items-center justify-center z-10">
                <Activity size={12} className="text-accent-purple" />
              </div>
              <div>
                <h4 className="font-bold text-sm capitalize">{item.stage.replace(/_/g, ' ')}</h4>
                <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}

          {(!agentState?.agent_loop?.stage_history || agentState.agent_loop.stage_history.length === 0) && (
            <div className="text-center py-8 text-slate-500">
              <Activity size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity recorded yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Topic Progress */}
      {data.weak_topics?.length > 0 && (
        <section>
          <h3 className="font-bold mb-4">Topic Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.weak_topics.map((topic, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">{topic.topic}</h4>
                  <span className={`text-sm font-bold ${
                    (topic.confidence || topic.score) >= 70 ? 'text-emerald-400' :
                    (topic.confidence || topic.score) >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {topic.confidence || topic.score}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (topic.confidence || topic.score) >= 70 ? 'bg-emerald-500' :
                      (topic.confidence || topic.score) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${topic.confidence || topic.score}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
