import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Clock, Activity, ArrowRight, Minus, 
  Zap, Target, BarChart3, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, ConfidenceChart, StrategyEvolution, Badge, ProgressBar } from '../components/ui';

// Learning Velocity Badge Component
const LearningVelocityCard = ({ velocity }) => {
  if (!velocity) return null;

  const config = {
    accelerating: { icon: TrendingUp, color: 'text-emerald-400', bg: 'from-emerald-500/20', label: 'Accelerating', desc: 'Learning faster than before!' },
    improving: { icon: TrendingUp, color: 'text-green-400', bg: 'from-green-500/20', label: 'Improving', desc: 'Good progress being made' },
    stable: { icon: Minus, color: 'text-blue-400', bg: 'from-blue-500/20', label: 'Stable', desc: 'Consistent pace maintained' },
    slowing: { icon: TrendingDown, color: 'text-amber-400', bg: 'from-amber-500/20', label: 'Slowing', desc: 'Consider refreshing your approach' },
    declining: { icon: TrendingDown, color: 'text-red-400', bg: 'from-red-500/20', label: 'Declining', desc: 'Might need a different strategy' }
  };

  const { icon: Icon, color, bg, label, desc } = config[velocity.direction] || config.stable;

  return (
    <Card className={`p-5 bg-linear-to-br ${bg} to-transparent`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center ${color}`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className={`font-bold text-lg ${color}`}>{label}</h3>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      {velocity.message && (
        <p className="text-sm text-slate-300">{velocity.message}</p>
      )}
      {velocity.rate_change !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          Rate change: <span className={color}>{velocity.rate_change > 0 ? '+' : ''}{velocity.rate_change}%</span>
        </div>
      )}
    </Card>
  );
};

// Engagement Level Card
const EngagementCard = ({ streaks }) => {
  if (!streaks) return null;

  const engagementConfig = {
    high: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Zap },
    good: { color: 'text-green-400', bg: 'bg-green-500/10', icon: TrendingUp },
    moderate: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Activity },
    low: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle }
  };

  const level = streaks.engagement_level || 'moderate';
  const { color, bg, icon: Icon } = engagementConfig[level] || engagementConfig.moderate;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-accent-teal" />
        <h3 className="font-bold">Engagement</h3>
      </div>

      <div className={`flex items-center gap-3 p-3 rounded-lg ${bg}`}>
        <Icon size={20} className={color} />
        <div>
          <span className={`font-bold capitalize ${color}`}>{level}</span>
          {streaks.engagement_message && (
            <p className="text-xs text-slate-400">{streaks.engagement_message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center p-3 bg-slate-800/50 rounded-lg">
          <div className="text-2xl font-bold text-emerald-400">{streaks.current_streak || 0}</div>
          <div className="text-[10px] text-slate-500 uppercase">Current Streak</div>
        </div>
        <div className="text-center p-3 bg-slate-800/50 rounded-lg">
          <div className="text-2xl font-bold text-accent-purple">{streaks.longest_streak || 0}</div>
          <div className="text-[10px] text-slate-500 uppercase">Best Streak</div>
        </div>
      </div>
    </Card>
  );
};

// Topic Progress Breakdown
const TopicBreakdown = ({ byTopic }) => {
  if (!byTopic || Object.keys(byTopic).length === 0) return null;

  return (
    <section>
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-accent-purple" />
        Topic Performance
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(byTopic).map(([topic, stats]) => {
          const successRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;
          
          return (
            <Card key={topic} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm truncate">{topic}</h4>
                <span className={`text-sm font-bold ${
                  successRate >= 70 ? 'text-emerald-400' :
                  successRate >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {successRate}%
                </span>
              </div>
              
              <ProgressBar 
                value={successRate} 
                color={successRate >= 70 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444'}
                showLabel={false}
              />

              <div className="flex justify-between mt-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  {stats.accepted || 0}
                </div>
                <div className="flex items-center gap-1">
                  <XCircle size={12} className="text-red-400" />
                  {(stats.total || 0) - (stats.accepted || 0)}
                </div>
                <span>{stats.total || 0} total</span>
              </div>

              {/* Error breakdown if available */}
              {stats.error_types && Object.keys(stats.error_types).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">Common Errors</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(stats.error_types).slice(0, 2).map(([type, count]) => (
                      <span key={type} className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Insight if available */}
              {stats.insight && (
                <p className="text-xs text-accent-teal mt-2 italic">{stats.insight}</p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
};

// Learning Insights Section
const LearningInsights = ({ insights }) => {
  if (!insights || insights.length === 0) return null;

  const insightIcons = {
    persistence: <CheckCircle2 size={14} className="text-emerald-400" />,
    giving_up: <AlertTriangle size={14} className="text-amber-400" />,
    topic_variety: <Target size={14} className="text-blue-400" />,
    default: <Zap size={14} className="text-accent-purple" />
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={18} className="text-amber-400" />
        <h3 className="font-bold">Learning Insights</h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-dark-900/50 rounded-lg">
            <div className="shrink-0 mt-0.5">
              {insightIcons[insight.type] || insightIcons.default}
            </div>
            <div>
              <h4 className="text-sm font-semibold">{insight.title}</h4>
              <p className="text-xs text-slate-400 mt-1">{insight.description}</p>
              {insight.examples && insight.examples.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {insight.examples.slice(0, 3).map((ex, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800 rounded">
                      {typeof ex === 'string' ? ex : ex.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default function Progress() {
  const navigate = useNavigate();
  const { user, data, hasData, agentState } = useApp();

  useEffect(() => {
    console.log('[Progress] Mount/Update', {
      hasData,
      recommendationsCount: data?.recommended_problems?.length || 0
    });
    if (!user) navigate('/');
  }, [user, navigate]); // FIXED: removed data?.recommended_problems dependency

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

  // Extract monitoring data
  const monitoring = agentState?.progress || {};
  const learningVelocity = agentState?.diagnosis?.learning_velocity;
  const streaks = monitoring.streaks;
  const byTopic = monitoring.by_topic;
  const insights = monitoring.insights;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">Learning Evolution</h2>
        <p className="text-slate-400">Tracking your mastery over time</p>
      </div>

      {/* Learning Velocity & Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LearningVelocityCard velocity={learningVelocity} />
        <EngagementCard streaks={streaks} />
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

      {/* Learning Insights */}
      <LearningInsights insights={insights} />

      {/* Strategy Evolution */}
      {agentState?.strategy_evolution && (
        <StrategyEvolution evolution={agentState.strategy_evolution} />
      )}

      {/* Topic Progress Breakdown */}
      <TopicBreakdown byTopic={byTopic} />

      {/* Weak Topics (fallback) */}
      {!byTopic && data.weak_topics?.length > 0 && (
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
                <h4 className="font-bold text-sm capitalize">{String(item?.stage ?? 'unknown_stage').replace(/_/g, ' ')}</h4>
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
    </div>
  );
}
