import React from 'react';
import {
  CheckCircle2, AlertTriangle, Info, Clock, ExternalLink, ArrowRight,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, History, MessageSquare,
  TrendingUp, BarChart3, RefreshCw, Target, Calendar, Activity, BookOpen
} from 'lucide-react';

// --- Base Components ---

export const Card = ({ children, className = "" }) => (
  <div className={`card ${className}`}>{children}</div>
);

export const Badge = ({ children, type = "neutral", className = "" }) => {
  const styles = {
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    info: "bg-accent-purple/10 text-accent-purple/80 border-accent-purple/20",
    critical: "bg-red-600/20 text-red-300 border-red-500/30",
    error: "bg-red-600/20 text-red-300 border-red-500/30"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[type] || styles.neutral} ${className}`}>
      {children}
    </span>
  );
};

export const ProgressBar = ({ value, color = "accent-purple", showLabel = true }) => (
  <div className="w-full">
    {showLabel && (
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-400">{value}%</span>
      </div>
    )}
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${value}%`, backgroundColor: color === 'accent-purple' ? 'var(--color-accent-purple)' : color }}
      />
    </div>
  </div>
);

// --- Smart Alerts Component ---

export const SmartAlerts = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  const alertIcons = {
    success: <CheckCircle2 size={16} className="text-emerald-400" />,
    warning: <AlertTriangle size={16} className="text-amber-400" />,
    error: <AlertTriangle size={16} className="text-red-400" />,
    info: <Info size={16} className="text-blue-400" />
  };

  const alertStyles = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    error: "border-red-500/30 bg-red-500/5",
    info: "border-blue-500/30 bg-blue-500/5"
  };

  return (
    <div className="space-y-2">
      {alerts.slice(0, 3).map((alert, idx) => (
        <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${alertStyles[alert.type] || alertStyles.info}`}>
          <div className="shrink-0 mt-0.5">{alert.icon || alertIcons[alert.type]}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">{alert.title}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Next Action Component ---

export const NextActionCard = ({ nextAction }) => {
  if (!nextAction) return null;

  const priorityColors = {
    critical: "border-red-500/50 bg-red-500/10",
    high: "border-amber-500/50 bg-amber-500/10",
    medium: "border-accent-purple/50 bg-accent-purple/10",
    low: "border-slate-500/50 bg-slate-500/10"
  };

  const priorityBadges = {
    critical: <Badge type="danger">Critical</Badge>,
    high: <Badge type="warning">High Priority</Badge>,
    medium: <Badge type="info">Medium</Badge>,
    low: <Badge type="neutral">Low</Badge>
  };

  return (
    <Card className={`${priorityColors[nextAction.priority] || priorityColors.medium} border-2`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-accent-teal" />
          <h3 className="font-bold">Next Action</h3>
        </div>
        {priorityBadges[nextAction.priority]}
      </div>

      <p className="text-sm font-medium mb-3">{nextAction.next_action}</p>

      {nextAction.details && (
        <p className="text-xs text-slate-400 mb-4">{nextAction.details}</p>
      )}

      {nextAction.problems && nextAction.problems.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Suggested Problems</h5>
          <div className="flex flex-wrap gap-2">
            {nextAction.problems.slice(0, 3).map((p, idx) => (
              <a
                key={idx}
                href={p.url || `https://leetcode.com/problems/${(p.slug || p.title || p).toString().toLowerCase().replace(/\s+/g, '-')}/`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-lg text-xs hover:bg-slate-700 transition-colors"
              >
                {p.lc_id || p.title || p}
                <ExternalLink size={10} />
              </a>
            ))}
          </div>
        </div>
      )}

      {nextAction.estimated_time && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock size={12} />
          <span>Estimated: {nextAction.estimated_time}</span>
        </div>
      )}
    </Card>
  );
};

// --- Strategy Evolution Component ---

export const StrategyEvolution = ({ evolution }) => {
  if (!evolution) return null;

  return (
    <Card className="bg-gradient-to-r from-slate-800/50 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <History size={18} className="text-accent-purple" />
        <h3 className="font-bold">Strategy Evolution</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-xs font-bold text-slate-400 uppercase">Before</span>
          </div>
          <h4 className="font-semibold text-sm mb-1 capitalize">{evolution.before?.action?.replace(/_/g, ' ')}</h4>
          <p className="text-xs text-slate-500">{evolution.before?.description}</p>
        </div>

        <div className="p-4 bg-accent-purple/10 rounded-lg border border-accent-purple/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-accent-purple animate-pulse" />
            <span className="text-xs font-bold text-accent-purple uppercase">Current</span>
          </div>
          <h4 className="font-semibold text-sm mb-1 capitalize">{evolution.after?.action?.replace(/_/g, ' ')}</h4>
          <p className="text-xs text-slate-400">{evolution.after?.description}</p>
        </div>
      </div>

      {evolution.change_reason && (
        <div className="mt-4 p-3 bg-dark-900/50 rounded-lg border border-slate-800">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-accent-teal">Reason:</span> {evolution.change_reason}
          </p>
        </div>
      )}
    </Card>
  );
};

// --- Decision Timeline Component ---

export const DecisionTimeline = ({ decisions }) => {
  if (!decisions || decisions.length === 0) return null;

  const agentColors = {
    diagnosisAgent: 'text-blue-400',
    goalAgent: 'text-accent-teal',
    planningAgent: 'text-accent-purple',
    monitoringAgent: 'text-emerald-400',
    adaptationAgent: 'text-amber-400'
  };

  const agentBgColors = {
    diagnosisAgent: 'bg-blue-500/20',
    goalAgent: 'bg-accent-teal/20',
    planningAgent: 'bg-accent-purple/20',
    monitoringAgent: 'bg-emerald-500/20',
    adaptationAgent: 'bg-amber-500/20'
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <MessageSquare size={18} className="text-accent-purple" />
          Agent Decisions
        </h3>
        <Badge type="info">{decisions.length} recent</Badge>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {decisions.map((decision, idx) => (
          <div key={idx} className="flex gap-3 p-3 bg-dark-900/50 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
            <div className={`w-8 h-8 rounded-lg ${agentBgColors[decision.agent] || 'bg-slate-800'} flex items-center justify-center shrink-0`}>
              <span className="text-sm">{decision.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold ${agentColors[decision.agent] || 'text-slate-400'}`}>
                  {decision.agent?.replace('Agent', '')}
                </span>
                <span className="text-[10px] text-slate-600">
                  {new Date(decision.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2">{decision.human_readable}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge type="neutral" className="text-[10px]">{Math.round(decision.confidence * 100)}% conf</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// --- Confidence Chart Component ---

export const ConfidenceChart = ({ chartData, overallTrend }) => {
  if (!chartData || !chartData.datasets || chartData.datasets.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No confidence data yet</p>
        </div>
      </Card>
    );
  }

  const primaryData = chartData.datasets[0]?.data || [];
  const maxValue = Math.max(...primaryData, 100);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <TrendingUp size={18} className="text-accent-teal" />
          Confidence Trend
        </h3>
        {overallTrend && (
          <div className="flex items-center gap-1">
            {overallTrend.direction?.includes('improving') ? (
              <ArrowUpRight size={14} className="text-emerald-400" />
            ) : overallTrend.direction?.includes('declining') ? (
              <ArrowDownRight size={14} className="text-red-400" />
            ) : (
              <Minus size={14} className="text-slate-400" />
            )}
            <span className="text-xs text-slate-400">{overallTrend.message}</span>
          </div>
        )}
      </div>

      <div className="h-40 flex items-end gap-1">
        {primaryData.map((value, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full">
              <div
                className="w-full bg-accent-purple/30 rounded-t transition-all duration-300 group-hover:bg-accent-purple/50"
                style={{ height: `${(value / maxValue) * 120}px` }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] bg-slate-800 px-1 rounded">{value}%</span>
              </div>
            </div>
            <span className="text-[9px] text-slate-600">{chartData.labels?.[idx] || idx + 1}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

// --- Agent Loop Indicator ---

export const AgentLoopIndicator = ({ currentStage, stageDescription, isRunning }) => {
  const stages = [
    { id: 'extracting', label: 'Extract', icon: <BookOpen size={14} /> },
    { id: 'diagnosing', label: 'Diagnose', icon: <Activity size={14} /> },
    { id: 'setting_goals', label: 'Goals', icon: <Target size={14} /> },
    { id: 'planning', label: 'Plan', icon: <Calendar size={14} /> },
    { id: 'monitoring', label: 'Monitor', icon: <BarChart3 size={14} /> },
    { id: 'adapting', label: 'Adapt', icon: <RefreshCw size={14} /> }
  ];

  const getCurrentIndex = () => stages.findIndex(s => s.id === currentStage);

  return (
    <Card className="bg-gradient-to-r from-accent-purple/5 to-accent-teal/5 border-accent-purple/20">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <RefreshCw size={16} className={isRunning ? "animate-spin text-accent-teal" : "text-slate-400"} />
          Agent Loop
        </h3>
        <Badge type={isRunning ? "success" : "neutral"}>
          {isRunning ? "Running" : currentStage === 'complete' ? "Complete" : "Idle"}
        </Badge>
      </div>

      {stageDescription && (
        <p className="text-xs text-slate-400 mb-4 italic">{stageDescription}</p>
      )}

      <div className="flex items-center justify-between gap-1">
        {stages.map((stage, index) => {
          const currentIndex = getCurrentIndex();
          const isActive = stage.id === currentStage;
          const isComplete = currentIndex > index || currentStage === 'complete';

          return (
            <React.Fragment key={stage.id}>
              <div className={`flex flex-col items-center gap-1 flex-1 ${isActive ? 'scale-110' : ''} transition-transform`}>
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all
                  ${isActive ? 'bg-accent-purple text-white ring-2 ring-accent-purple/50 ring-offset-2 ring-offset-dark-900' : ''}
                  ${isComplete && !isActive ? 'bg-emerald-500/20 text-emerald-400' : ''}
                  ${!isComplete && !isActive ? 'bg-slate-800 text-slate-500' : ''}
                `}>
                  {isComplete && !isActive ? <CheckCircle2 size={14} /> : stage.icon}
                </div>
                <span className={`text-[9px] font-medium uppercase tracking-wider ${isActive ? 'text-accent-purple' : 'text-slate-500'}`}>
                  {stage.label}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div className={`text-slate-700 shrink-0 ${isComplete ? 'text-emerald-500/50' : ''}`}>›</div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
};

// --- Goals Panel ---

export const GoalsPanel = ({ goals }) => {
  if (!goals || goals.length === 0) {
    return (
      <Card className="border-dashed border-slate-700">
        <div className="text-center py-8 text-slate-500">
          <Target size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No goals set yet</p>
          <p className="text-xs mt-1">Extract your LeetCode data to generate goals</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Target size={18} className="text-accent-teal" />
          Active Goals
        </h3>
        <Badge type="info">{goals.length} goals</Badge>
      </div>
      <div className="space-y-4">
        {goals.slice(0, 3).map((goal, index) => (
          <div key={goal.id || index} className="p-4 bg-dark-900/50 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{goal.topic}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{goal.deadline_days} days remaining</p>
              </div>
              <Badge type={goal.severity === 'critical' ? 'critical' : goal.severity === 'high' ? 'danger' : 'warning'}>
                {goal.severity}
              </Badge>
            </div>

            {/* Dynamic Description */}
            {goal.description && (
              <p className="text-xs text-slate-400 mb-3 line-clamp-2">{goal.description}</p>
            )}

            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">{goal.current_score}%</div>
                <div className="text-[9px] text-slate-500 uppercase">Current</div>
              </div>
              <ArrowRight size={16} className="text-slate-600" />
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">{goal.target_score}%</div>
                <div className="text-[9px] text-slate-500 uppercase">Target</div>
              </div>
            </div>
            <ProgressBar value={Math.round((goal.current_score / goal.target_score) * 100)} color="#4ad9c8" showLabel={false} />

            {/* Milestones preview */}
            {goal.milestones && goal.milestones.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <CheckCircle2 size={10} />
                  {goal.milestones.length} milestones
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

// --- Learning Plan ---

export const LearningPlan = ({ plan, onAdvanceDay }) => {
  if (!plan || !plan.plan || plan.plan.length === 0) {
    return (
      <Card className="border-dashed border-slate-700">
        <div className="text-center py-8 text-slate-500">
          <Calendar size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No learning plan created</p>
        </div>
      </Card>
    );
  }

  const currentDay = plan.current_day || 1;
  const todaysPlan = plan.plan.filter(p => p.day === currentDay);
  const personalization = plan.personalization || [];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Calendar size={18} className="text-accent-purple" />
          Learning Plan
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Day {currentDay}/{plan.summary?.total_days || '?'}</span>
          <button onClick={onAdvanceDay} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors" title="Mark day complete">
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Personalization Notes */}
      {personalization.length > 0 && (
        <div className="mb-4 p-3 bg-accent-teal/5 rounded-lg border border-accent-teal/20">
          <h5 className="text-[10px] font-bold text-accent-teal uppercase tracking-wider mb-2">Why This Plan?</h5>
          <ul className="space-y-1">
            {personalization.slice(0, 3).map((note, idx) => (
              <li key={idx} className="text-xs text-slate-400 flex items-start gap-1">
                <span className="text-accent-teal">•</span> {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-xs font-bold text-accent-teal uppercase tracking-wider mb-3">Today's Focus</h4>
        {todaysPlan.length > 0 ? (
          <div className="space-y-3">
            {todaysPlan.map((item, idx) => (
              <div key={idx} className="p-4 bg-accent-purple/10 border border-accent-purple/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{item.focus}</span>
                  <Badge type={item.difficulty === 'easy' ? 'success' : item.difficulty === 'hard' ? 'danger' : 'warning'}>
                    {item.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mb-3">{item.objective}</p>
                
                {/* Problems */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.problems?.map((problem, pIdx) => (
                    <a key={pIdx} href={problem.url || `https://leetcode.com/problems/${(problem.slug || problem.title || problem).toString().toLowerCase().replace(/\s+/g, '-')}/`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs hover:bg-slate-700 transition-colors group">
                      <span>{problem.title || problem.lc_id || problem}</span>
                      <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                    </a>
                  ))}
                </div>

                {/* Tip if available */}
                {item.tip && (
                  <p className="text-xs text-accent-teal italic p-2 bg-accent-teal/5 rounded">
                    💡 {item.tip}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No items for today</p>
        )}
      </div>

      {/* Plan Summary */}
      {plan.summary && (
        <div className="pt-3 border-t border-slate-700 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-accent-purple">{plan.summary.total_problems || 0}</div>
            <div className="text-[9px] text-slate-500 uppercase">Problems</div>
          </div>
          <div>
            <div className="text-lg font-bold text-accent-teal">{plan.summary.topics_covered?.length || 0}</div>
            <div className="text-[9px] text-slate-500 uppercase">Topics</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">{plan.summary.estimated_total_hours || '?'}h</div>
            <div className="text-[9px] text-slate-500 uppercase">Est. Time</div>
          </div>
        </div>
      )}
    </Card>
  );
};

// --- Progress Tracker ---

export const ProgressTracker = ({ progress, metrics }) => {
  const successRate = progress?.progress?.success_rate || 0;
  const trend = progress?.trend;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-400" />
          Progress
        </h3>
        <Badge type={progress?.status === 'improving' ? 'success' : progress?.status === 'struggling' ? 'danger' : 'neutral'}>
          {progress?.status_emoji} {progress?.status?.replace('_', ' ') || 'N/A'}
        </Badge>
      </div>

      <div className="flex items-center gap-6 mb-4">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle cx="40" cy="40" r="32" fill="none"
              stroke={successRate >= 70 ? '#10b981' : successRate >= 50 ? '#4ad9c8' : '#ef4444'}
              strokeWidth="6" strokeDasharray={`${successRate * 2.01} 201`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{successRate}%</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Accepted</span>
            <span className="font-bold text-emerald-400">{progress?.progress?.accepted || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Attempts</span>
            <span className="font-bold">{progress?.progress?.attempts || 0}</span>
          </div>
        </div>
      </div>

      {trend && trend.direction !== 'insufficient_data' && (
        <div className="p-2 bg-dark-900/50 rounded-lg text-xs flex items-center gap-2">
          {trend.direction?.includes('improving') ? <ArrowUpRight size={14} className="text-emerald-400" /> :
            trend.direction?.includes('declining') ? <ArrowDownRight size={14} className="text-red-400" /> :
              <Minus size={14} className="text-slate-400" />}
          <span className="text-slate-300">{trend.message}</span>
        </div>
      )}
    </Card>
  );
};

// --- Adaptation Panel ---

export const AdaptationPanel = ({ adaptation }) => {
  if (!adaptation) return null;

  const actionIcons = {
    increase_difficulty: <TrendingUp size={16} className="text-emerald-400" />,
    simplify_problems: <RefreshCw size={16} className="text-amber-400" />,
    maintain_pace: <Activity size={16} className="text-blue-400" />,
    change_strategy: <RefreshCw size={16} className="text-accent-purple" />,
    add_practice: <Target size={16} className="text-amber-400" />,
    reset_foundation: <RefreshCw size={16} className="text-red-400" />,
    pause_and_review: <Clock size={16} className="text-amber-400" />
  };

  return (
    <Card className="bg-gradient-to-br from-accent-teal/5 to-transparent border-accent-teal/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Activity size={18} className="text-accent-teal" />
          Strategy Adaptation
        </h3>
        <Badge type="info">{Math.round(adaptation.confidence || 50)}% conf</Badge>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
          {actionIcons[adaptation.action] || <RefreshCw size={16} />}
        </div>
        <div>
          <h4 className="font-semibold text-sm capitalize">{adaptation.action?.replace(/_/g, ' ')}</h4>
          <p className="text-xs text-slate-400 mt-1">{adaptation.reason}</p>
        </div>
      </div>

      {/* Summary if available */}
      {adaptation.summary && (
        <p className="text-sm text-slate-300 mb-4 p-3 bg-dark-900/30 rounded-lg italic">
          {adaptation.summary}
        </p>
      )}

      {/* Strategy message if available */}
      {adaptation.strategy?.message && (
        <div className="p-3 bg-accent-purple/10 rounded-lg border border-accent-purple/20 mb-4">
          <p className="text-xs text-accent-purple font-medium">{adaptation.strategy.emoji} {adaptation.strategy.message}</p>
        </div>
      )}

      {adaptation.recommendations?.length > 0 && (
        <div className="space-y-2 mb-4">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recommendations</h5>
          {adaptation.recommendations.slice(0, 3).map((rec, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-dark-900/50 rounded-lg text-xs">
              <CheckCircle2 size={12} className={`shrink-0 mt-0.5 ${
                rec.priority === 'high' ? 'text-red-400' :
                rec.priority === 'medium' ? 'text-amber-400' : 'text-accent-teal'
              }`} />
              <div className="flex-1">
                <span className="text-slate-300">{rec.text}</span>
                {rec.action && (
                  <span className="text-accent-teal ml-1">→ {rec.action}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Next check info */}
      {adaptation.next_check && (
        <div className="pt-3 border-t border-slate-700 text-xs text-slate-500 flex items-center gap-2">
          <Clock size={12} />
          Next review: {adaptation.next_check.interval}
          {adaptation.next_check.tip && (
            <span className="text-slate-400 ml-2">• {adaptation.next_check.tip}</span>
          )}
        </div>
      )}
    </Card>
  );
};
