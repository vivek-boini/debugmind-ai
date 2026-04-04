import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Target, ArrowRight, CheckCircle2, Circle, Clock, Zap, 
  ChevronDown, ChevronUp, Calendar, AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Badge, LearningPlan, ConfidenceChart, Card, ProgressBar } from '../components/ui';

// Enhanced Goal Card with milestones
const GoalCard = ({ goal, isExpanded, onToggle }) => {
  const severityColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    high: 'border-amber-500/50 bg-amber-500/5',
    medium: 'border-accent-purple/50 bg-accent-purple/5'
  };

  const progressPercent = Math.min(100, Math.round((goal.current_score / goal.target_score) * 100));

  return (
    <Card className={`${severityColors[goal.severity] || severityColors.medium} border-2 transition-all`}>
      {/* Header */}
      <div 
        className="flex items-start justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Target size={18} className="text-accent-teal" />
            <h3 className="font-bold text-lg">{goal.topic}</h3>
          </div>
          <Badge type={goal.severity === 'critical' ? 'danger' : goal.severity === 'high' ? 'warning' : 'info'}>
            {goal.severity}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock size={12} />
              <span className="text-xs">{goal.deadline_days} days</span>
            </div>
          </div>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Dynamic Description */}
      {goal.description && (
        <p className="text-sm text-slate-300 mt-3 leading-relaxed">
          {goal.description}
        </p>
      )}

      {/* Description Parts (if available) */}
      {goal.description_parts && (
        <div className="mt-3 space-y-1">
          {goal.description_parts.main && (
            <p className="text-sm text-slate-300">{goal.description_parts.main}</p>
          )}
          {goal.description_parts.error_focus && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle size={12} /> {goal.description_parts.error_focus}
            </p>
          )}
          {goal.description_parts.confidence_focus && (
            <p className="text-xs text-accent-teal flex items-center gap-1">
              <Zap size={12} /> {goal.description_parts.confidence_focus}
            </p>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
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
          <span className="text-xs text-slate-400">{progressPercent}% complete</span>
        </div>
        <ProgressBar value={progressPercent} color="#4ad9c8" showLabel={false} />
      </div>

      {/* Expanded Content: Milestones */}
      {isExpanded && goal.milestones && goal.milestones.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={14} /> Milestones
          </h4>
          <div className="space-y-2">
            {goal.milestones.map((milestone, idx) => {
              const isCompleted = goal.current_score >= (goal.target_score * (idx + 1) / goal.milestones.length);
              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                    isCompleted ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/50'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${isCompleted ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {milestone}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy (if available) */}
      {isExpanded && goal.strategy && (
        <div className="mt-4 p-3 bg-accent-purple/10 rounded-lg border border-accent-purple/20">
          <h5 className="text-xs font-bold text-accent-purple uppercase mb-1">Strategy</h5>
          <p className="text-xs text-slate-300">{goal.strategy}</p>
        </div>
      )}

      {/* Related Errors (if available) */}
      {isExpanded && goal.related_errors && goal.related_errors.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Common Errors to Fix</h5>
          <div className="flex flex-wrap gap-2">
            {goal.related_errors.map((err, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded">
                {err}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

// Goals Summary Component
const GoalsSummary = ({ goals }) => {
  if (!goals || goals.length === 0) return null;

  const critical = goals.filter(g => g.severity === 'critical').length;
  const high = goals.filter(g => g.severity === 'high').length;
  const medium = goals.filter(g => g.severity === 'medium').length;
  const avgProgress = Math.round(
    goals.reduce((sum, g) => sum + (g.current_score / g.target_score) * 100, 0) / goals.length
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="p-4 text-center bg-gradient-to-br from-red-500/10 to-transparent">
        <div className="text-2xl font-bold text-red-400">{critical}</div>
        <div className="text-xs text-slate-500">Critical</div>
      </Card>
      <Card className="p-4 text-center bg-gradient-to-br from-amber-500/10 to-transparent">
        <div className="text-2xl font-bold text-amber-400">{high}</div>
        <div className="text-xs text-slate-500">High Priority</div>
      </Card>
      <Card className="p-4 text-center bg-gradient-to-br from-accent-purple/10 to-transparent">
        <div className="text-2xl font-bold text-accent-purple">{medium}</div>
        <div className="text-xs text-slate-500">Medium</div>
      </Card>
      <Card className="p-4 text-center bg-gradient-to-br from-emerald-500/10 to-transparent">
        <div className="text-2xl font-bold text-emerald-400">{avgProgress}%</div>
        <div className="text-xs text-slate-500">Avg Progress</div>
      </Card>
    </div>
  );
};

export default function Goals() {
  const navigate = useNavigate();
  const { user, hasData, agentState, advanceDay } = useApp();
  const [expandedGoal, setExpandedGoal] = useState(null);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  if (!hasData) {
    return (
      <EmptyState
        title="No Goals Set"
        message="Complete an analysis first to generate personalized learning goals."
        icon={Target}
        action={
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Start Analysis <ArrowRight size={18} />
          </Link>
        }
      />
    );
  }

  const goals = agentState?.goals || [];
  const goalsData = agentState?.goals_data || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Goals & Learning Plan</h2>
          <p className="text-slate-400">Your personalized roadmap to mastery</p>
        </div>
        <Badge type="info">{goals.length} active goals</Badge>
      </div>

      {/* Goals Summary */}
      <GoalsSummary goals={goals} />

      {/* Summary Message */}
      {goalsData.summary && (
        <Card className="p-4 bg-gradient-to-r from-accent-purple/10 to-transparent border-accent-purple/20">
          <p className="text-sm text-slate-300 italic">{goalsData.summary}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Goals List */}
        <div className="space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Target size={18} className="text-accent-teal" />
            Active Goals
          </h3>
          {goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal, index) => (
                <GoalCard 
                  key={goal.id || index} 
                  goal={goal}
                  isExpanded={expandedGoal === index}
                  onToggle={() => setExpandedGoal(expandedGoal === index ? null : index)}
                />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <Target size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No goals set yet</p>
            </Card>
          )}
        </div>

        {/* Learning Plan */}
        <LearningPlan plan={agentState?.plan} onAdvanceDay={advanceDay} />
      </div>

      {agentState?.confidence_history?.chart_data && (
        <ConfidenceChart
          chartData={agentState.confidence_history.chart_data}
          overallTrend={agentState.confidence_history.overall_trend}
        />
      )}
    </div>
  );
}
