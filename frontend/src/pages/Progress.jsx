import React, { useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Clock, Activity, ArrowRight, Minus, 
  Zap, Target, BarChart3, CheckCircle2, XCircle, AlertTriangle,
  ArrowUpRight, Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, ConfidenceChart, StrategyEvolution, Badge, ProgressBar } from '../components/ui';

// ── FIX 10: Normalize helper — logs warnings, does NOT silently mask ──
function normalizeCount(value, fieldName) {
  const num = Number(value || 0);
  if (isNaN(num)) {
    console.warn(`[Progress] Invalid ${fieldName}: not a number`, value);
    return 0;
  }
  if (num < 0) {
    console.warn(`[Progress] Invalid ${fieldName}: negative value`, num);
  }
  return num;
}

// ── FIX 16: Consistent number formatting ──
function formatPercent(value) {
  if (typeof value !== 'number' || isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

// ── FIX 17: Relative time helper (polished) ──
function timeAgo(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

// ── FIX 18: Color consistency — same meaning = same color everywhere ──
function getStatusColor(status) {
  switch (status) {
    case 'Improving': return 'text-emerald-400';
    case 'Needs Attention': return 'text-red-400';
    case 'Stable': return 'text-blue-400';
    case 'Getting Started': return 'text-slate-400';
    default: return 'text-slate-400';
  }
}

function getStatusBg(status) {
  switch (status) {
    case 'Improving': return 'from-emerald-500/20';
    case 'Needs Attention': return 'from-red-500/20';
    case 'Stable': return 'from-blue-500/20';
    case 'Getting Started': return 'from-slate-500/20';
    default: return 'from-slate-500/20';
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'Improving': return TrendingUp;
    case 'Needs Attention': return TrendingDown;
    case 'Stable': return Minus;
    default: return Minus;
  }
}

function getPercentColor(rate) {
  if (rate >= 70) return 'text-emerald-400';
  if (rate >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getPercentBarColor(rate) {
  if (rate >= 70) return '#10b981';
  if (rate >= 40) return '#f59e0b';
  return '#ef4444';
}

// ── Learning Velocity Card (FIX 1, 16, 18) ──
const LearningVelocityCard = ({ velocity, metrics }) => {
  const dataPoints = normalizeCount(metrics?.total_submissions, 'total_submissions');
  const direction = velocity?.direction;

  // FIX 18: Consistent status derivation
  let status, message;
  if (!direction || dataPoints < 2) {
    status = 'Getting Started';
    message = 'Solve more problems to see your progress';
  } else if (direction === 'improving' || direction === 'accelerating') {
    status = 'Improving';
    message = velocity?.message || "You're getting better over time";
  } else if (direction === 'declining' || direction === 'slowing') {
    status = 'Needs Attention';
    message = velocity?.message || 'Focus on weak topics to improve';
  } else {
    status = 'Stable';
    message = velocity?.message || "You're maintaining consistency";
  }

  // FIX 18: Use consistent color helpers
  const color = getStatusColor(status);
  const bg = getStatusBg(status);
  const Icon = getStatusIcon(status);

  // FIX 13+16: Strict trend display with consistent formatting
  const rateChange = velocity?.rate_change;
  const showTrend = dataPoints >= 2 && typeof rateChange === 'number' && !isNaN(rateChange);

  return (
    <Card className={`p-5 bg-linear-to-br ${bg} to-transparent`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center ${color}`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className={`font-bold text-lg ${color}`}>{status}</h3>
          <p className="text-xs text-slate-400">{message}</p>
        </div>
      </div>
      {/* FIX 16: Consistent formatting */}
      {showTrend && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          Rate change: <span className={color}>{rateChange > 0 ? '+' : ''}{rateChange.toFixed(1)}%</span>
        </div>
      )}
      {/* FIX 19: Don't show half-baked trend info */}
      {!showTrend && dataPoints > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          Not enough data to determine trend
        </div>
      )}
    </Card>
  );
};

// ── FIX 6: Dynamic Engagement (removed fake "Highly Active") ──
const EngagementCard = ({ streaks }) => {
  if (!streaks) return null;

  const currentStreak = normalizeCount(streaks.current_streak, 'current_streak');
  const longestStreak = normalizeCount(streaks.longest_streak, 'longest_streak');

  let engagementMessage, engagementColor, engagementBg, EngagementIcon;

  if (currentStreak === 0) {
    engagementMessage = "Start solving daily to build a streak";
    engagementColor = 'text-slate-400';
    engagementBg = 'bg-slate-500/10';
    EngagementIcon = Activity;
  } else if (currentStreak < 3) {
    engagementMessage = "Good start, keep going";
    engagementColor = 'text-amber-400';
    engagementBg = 'bg-amber-500/10';
    EngagementIcon = TrendingUp;
  } else {
    engagementMessage = "You're consistent — keep it up";
    engagementColor = 'text-emerald-400';
    engagementBg = 'bg-emerald-500/10';
    EngagementIcon = Zap;
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-accent-teal" />
        <h3 className="font-bold">Engagement</h3>
      </div>

      <div className={`flex items-center gap-3 p-3 rounded-lg ${engagementBg}`}>
        <EngagementIcon size={20} className={engagementColor} />
        <div>
          <span className={`font-bold ${engagementColor}`}>
            {currentStreak === 0 ? 'No Streak' : `${currentStreak} Day Streak`}
          </span>
          <p className="text-xs text-slate-400">{engagementMessage}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center p-3 bg-slate-800/50 rounded-lg">
          <div className="text-2xl font-bold text-emerald-400">{currentStreak}</div>
          <div className="text-[10px] text-slate-500 uppercase">Current Streak</div>
        </div>
        <div className="text-center p-3 bg-slate-800/50 rounded-lg">
          <div className="text-2xl font-bold text-accent-purple">{longestStreak}</div>
          <div className="text-[10px] text-slate-500 uppercase">Best Streak</div>
        </div>
      </div>
    </Card>
  );
};

// ── FIX 10 + FIX 11: Topic Progress with normalized data & clear no-data vs low-perf ──
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
          // FIX 10: Normalize, don't silently fix
          const accepted = normalizeCount(stats.accepted, `${topic}.accepted`);
          const total = normalizeCount(stats.total, `${topic}.total`);
          const failed = total - accepted;

          // FIX 11: Clear distinction — no data vs low performance
          let successRate, showPercentage, label;

          if (total === 0) {
            successRate = 0;
            showPercentage = false;
            label = "No attempts yet";
          } else {
            successRate = Math.round((accepted / total) * 100);
            showPercentage = true;
            label = `${successRate}% success rate`;
          }

          // FIX 3: Clean topic messages
          let topicMessage;
          if (total === 0) {
            topicMessage = "No attempts yet";
          } else if (successRate >= 70) {
            topicMessage = "Good progress in this topic";
          } else if (successRate >= 40) {
            topicMessage = "Keep practicing to improve consistency";
          } else {
            topicMessage = "Focus on basics and solve easier problems";
          }

          // FIX 10: Warn if data looks wrong (negative values)
          if (failed < 0) {
            console.warn(`[Progress] Topic "${topic}" has more accepted than total`, { accepted, total });
          }
          
          return (
            <Card key={topic} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm truncate">{topic}</h4>
                {/* FIX 11: Show % only when there's data, show "—" otherwise */}
                {showPercentage ? (
                  <span className={`text-sm font-bold ${
                    successRate >= 70 ? 'text-emerald-400' :
                    successRate >= 40 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {formatPercent(successRate)}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>
              
              {showPercentage && (
                <ProgressBar 
                  value={successRate} 
                  color={successRate >= 70 ? '#10b981' : successRate >= 40 ? '#f59e0b' : '#ef4444'}
                  showLabel={false}
                />
              )}

              <div className="flex justify-between mt-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  {accepted} solved
                </div>
                <div className="flex items-center gap-1">
                  <XCircle size={12} className="text-red-400" />
                  {/* FIX 10: Show actual value, warn if negative */}
                  {failed < 0 ? (
                    <span className="text-amber-400" title="Data inconsistency detected">⚠ {failed}</span>
                  ) : (
                    <>{failed} failed</>
                  )}
                </div>
                <span>{total} total</span>
              </div>

              <p className="text-xs text-slate-400 mt-2 italic">{topicMessage}</p>

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
            </Card>
          );
        })}
      </div>
    </section>
  );
};

// Learning Insights Section (unchanged, already safe)
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

// ── Overall Progress Summary (FIX 7, 10, 11, 12, 13, 16, 17, 18, 19) ──
const ProgressSummaryCard = ({ metrics, velocity, monitoring, lastUpdated }) => {
  const totalSubmissions = normalizeCount(metrics?.total_submissions, 'total_submissions');
  const totalAccepted = normalizeCount(metrics?.total_accepted, 'total_accepted');

  // FIX 11: Clear no-data vs low-performance
  let successRate, showPercentage;
  if (totalSubmissions === 0) {
    successRate = 0;
    showPercentage = false;
  } else {
    successRate = (totalAccepted / totalSubmissions) * 100;
    showPercentage = true;
  }

  // FIX 13+18: Derive status consistently
  const dataPoints = totalSubmissions;
  const direction = velocity?.direction;
  const rateChange = velocity?.rate_change;
  const showTrend = dataPoints >= 2 && typeof rateChange === 'number' && !isNaN(rateChange) && !!direction;

  let trendStatus;
  if (!showTrend) {
    trendStatus = 'Getting Started';
  } else if (direction === 'improving' || direction === 'accelerating') {
    trendStatus = 'Improving';
  } else if (direction === 'declining' || direction === 'slowing') {
    trendStatus = 'Needs Attention';
  } else {
    trendStatus = 'Stable';
  }

  // FIX 18: Consistent colors
  const trendColor = getStatusColor(trendStatus);
  const TrendIcon = getStatusIcon(trendStatus);

  // Human-readable summary
  let summaryText;
  if (totalSubmissions === 0) {
    summaryText = 'Solve problems and extract data to track your progress.';
  } else if (successRate >= 70) {
    summaryText = "Great work! You're performing well. Keep challenging yourself.";
  } else if (successRate >= 40) {
    summaryText = "You're making progress. Focus on weak areas to improve faster.";
  } else {
    summaryText = 'Keep practicing. Focus on understanding core concepts.';
  }

  // FIX 17: Relative time
  const lastUpdatedText = timeAgo(lastUpdated);

  return (
    <Card className="p-6 bg-linear-to-br from-accent-purple/10 via-transparent to-accent-teal/5 border-accent-purple/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-accent-purple" />
          <h3 className="text-lg font-bold">Overall Progress</h3>
        </div>
        {/* FIX 17: Show relative time */}
        {lastUpdatedText && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={12} />
            <span>Updated {lastUpdatedText}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* FIX 16+18: Success Rate with consistent formatting & color */}
        <div className="text-center p-3 bg-slate-800/50 rounded-xl">
          <div className={`text-2xl font-bold ${
            !showPercentage ? 'text-slate-500' : getPercentColor(successRate)
          }`}>
            {showPercentage ? formatPercent(successRate) : '—'}
          </div>
          <div className="text-[10px] text-slate-500 uppercase mt-1">
            {!showPercentage ? 'No attempts yet' : 'Success Rate'}
          </div>
        </div>

        {/* Problems Solved */}
        <div className="text-center p-3 bg-slate-800/50 rounded-xl">
          <div className="text-2xl font-bold text-accent-teal">{totalAccepted}</div>
          <div className="text-[10px] text-slate-500 uppercase mt-1">Problems Solved</div>
        </div>

        {/* FIX 16+19: Trend — hide when insufficient data */}
        <div className="text-center p-3 bg-slate-800/50 rounded-xl">
          {showTrend ? (
            <>
              <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
                <TrendIcon size={18} />
                <span className="text-lg font-bold">
                  {rateChange > 0 ? '+' : ''}{rateChange.toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500 uppercase mt-1">{trendStatus}</div>
            </>
          ) : (
            <>
              <div className="text-slate-500"><Minus size={18} className="mx-auto" /></div>
              <div className="text-[10px] text-slate-500 uppercase mt-1">Trend</div>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-300 italic">{summaryText}</p>

      {/* FIX 19: Only show insufficient data note when there IS some data but not enough */}
      {!showTrend && totalSubmissions > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          ℹ️ Not enough data to determine trend. Solve more problems and extract again.
        </p>
      )}
    </Card>
  );
};

export default function Progress() {
  const navigate = useNavigate();
  const { user, data, hasData, agentState, dataStatus, isPolling } = useApp();

  useEffect(() => {
    console.log('[Progress] Mount/Update', {
      hasData,
      dataStatus,
      recommendationsCount: data?.recommended_problems?.length || 0
    });
    if (!user) navigate('/');
  }, [user, navigate]);

  // ── FIX 14: Stable empty state — show loading during processing, not empty flicker ──
  if (dataStatus === 'unknown' && isPolling) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
        <Loader2 size={40} className="text-accent-purple animate-spin mb-4" />
        <h3 className="text-lg font-bold mb-2">Loading Progress Data...</h3>
        <p className="text-sm text-slate-400">Please wait while we fetch your latest data.</p>
      </div>
    );
  }

  if (agentState?.status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
        <Loader2 size={40} className="text-accent-teal animate-spin mb-4" />
        <h3 className="text-lg font-bold mb-2">Analysis in Progress...</h3>
        <p className="text-sm text-slate-400">Your data is being processed. This page will update automatically.</p>
      </div>
    );
  }

  // FIX 14+21: Only show empty state when confirmed no data — with clear action steps
  if (!hasData) {
    return (
      <div className="text-center py-16 animate-in fade-in duration-500">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-800 flex items-center justify-center">
          <TrendingUp size={32} className="text-slate-500" />
        </div>
        <h3 className="text-xl font-bold mb-2">No progress data yet.</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          We'll track your improvement here once you get started.
        </p>
        <div className="max-w-sm mx-auto bg-slate-800/50 rounded-xl p-5 mb-6 text-left">
          <h4 className="text-sm font-bold text-accent-teal mb-3">Get started:</h4>
          <ol className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">1</span>
              Solve a few problems on LeetCode
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">2</span>
              Click <strong className="text-white">"Extract Latest Data"</strong> on Dashboard
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
              Your progress will appear here automatically
            </li>
          </ol>
        </div>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          Go to Dashboard <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  // FIX 9: Safe data extraction with fallbacks
  const monitoring = agentState?.progress || {};
  const learningVelocity = agentState?.diagnosis?.learning_velocity;
  const streaks = monitoring.streaks;
  const byTopic = monitoring.by_topic;
  const insights = monitoring.insights;
  const metrics = agentState?.metrics || {};
  const chartData = agentState?.confidence_history?.chart_data;
  const overallTrend = agentState?.confidence_history?.overall_trend;
  const lastUpdated = agentState?.lastUpdated;

  // FIX 5: Filter valid timeline entries
  const stageHistory = useMemo(() => {
    const raw = agentState?.agent_loop?.stage_history || [];
    // If it's an array of strings (just stage names), skip rendering
    if (raw.length > 0 && typeof raw[0] === 'string') return [];
    // Filter entries with valid date/timestamp
    return raw
      .filter(item => item && (item.timestamp || item.date))
      .filter(item => {
        const dateVal = new Date(item.timestamp || item.date);
        return !isNaN(dateVal.getTime());
      })
      .slice(-8)
      .reverse();
  }, [agentState?.agent_loop?.stage_history]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">Learning Evolution</h2>
        <p className="text-slate-400">Tracking your mastery over time</p>
      </div>

      {/* FIX 7 + 12: Overall Progress Summary with Last Updated */}
      <ProgressSummaryCard 
        metrics={metrics} 
        velocity={learningVelocity}
        monitoring={monitoring}
        lastUpdated={lastUpdated}
      />

      {/* FIX 1 + FIX 6: Learning Velocity & Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LearningVelocityCard velocity={learningVelocity} metrics={metrics} />
        <EngagementCard streaks={streaks} />
      </div>

      {/* FIX 19: Only show chart when we have enough data to render meaningfully */}
      {(() => {
        const totalSubs = normalizeCount(metrics.total_submissions, 'total_submissions');
        const totalAcc = normalizeCount(metrics.total_accepted, 'total_accepted');
        const rate = totalSubs > 0 ? (totalAcc / totalSubs) * 100 : 0;
        const hasEnoughForChart = chartData?.datasets?.[0]?.data?.length >= 2;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              {/* FIX 19: Hide chart if not enough data points */}
              {hasEnoughForChart ? (
                <ConfidenceChart chartData={chartData} overallTrend={overallTrend} />
              ) : (
                <Card className="h-64 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <BarChart3 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No progress data yet.</p>
                    <p className="text-xs mt-1 text-slate-600">Solve problems and extract again to track improvement.</p>
                  </div>
                </Card>
              )}
            </div>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Submissions</div>
                <div className="text-3xl font-bold">{totalSubs}</div>
              </Card>
              <Card className="p-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Success Rate</div>
                {/* FIX 16+18: Consistent formatting and color */}
                {totalSubs === 0 ? (
                  <>
                    <div className="text-3xl font-bold text-slate-500">—</div>
                    <p className="text-[10px] text-slate-500 mt-1">No attempts yet</p>
                  </>
                ) : (
                  <div className={`text-3xl font-bold ${getPercentColor(rate)}`}>
                    {formatPercent(rate)}
                  </div>
                )}
              </Card>
              <Card className="p-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Agent Loops</div>
                <div className="text-3xl font-bold text-accent-purple">{agentState?.agent_loop?.total_runs || 0}</div>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Learning Insights */}
      <LearningInsights insights={insights} />

      {/* Strategy Evolution */}
      {agentState?.strategy_evolution && (
        <StrategyEvolution evolution={agentState.strategy_evolution} />
      )}

      {/* FIX 10 + 11: Topic Progress Breakdown */}
      <TopicBreakdown byTopic={byTopic} />

      {/* Weak Topics (fallback) */}
      {!byTopic && data.weak_topics?.length > 0 && (
        <section>
          <h3 className="font-bold mb-4">Topic Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.weak_topics.map((topic, i) => {
              const score = normalizeCount(topic.confidence || topic.score, 'weak_topic_score');
              return (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">{topic.topic}</h4>
                    <span className={`text-sm font-bold ${
                      score >= 70 ? 'text-emerald-400' :
                      score >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score >= 70 ? 'bg-emerald-500' :
                        score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* FIX 5: Activity Timeline — hide invalid entries */}
      {stageHistory.length > 0 && (
        <section>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Clock size={18} /> Activity Timeline
          </h3>
          <div className="space-y-0 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {stageHistory.map((item, i) => {
              const stage = item.stage || 'Data Extracted';
              const dateObj = new Date(item.timestamp || item.date);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              });

              return (
                <div key={i} className="flex gap-6 pb-6 relative">
                  <div className="w-8 h-8 rounded-full bg-dark-900 border-2 border-slate-800 flex items-center justify-center z-10">
                    <Activity size={12} className="text-accent-purple" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm capitalize">{String(stage).replace(/_/g, ' ')}</h4>
                    <p className="text-xs text-slate-400">{formattedDate}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Show empty timeline message only if no history at all */}
      {stageHistory.length === 0 && (
        <section>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Clock size={18} /> Activity Timeline
          </h3>
          <div className="text-center py-8 text-slate-500">
            <Activity size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity recorded yet</p>
          </div>
        </section>
      )}
    </div>
  );
}
