import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, BrainCircuit, AlertTriangle, CheckCircle2, 
  Zap, ListOrdered, ChevronRight, Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WaitingForData, EmptyState } from '../components/Loader';
import {
  Card, Badge, ProgressBar, SmartAlerts, NextActionCard, StrategyEvolution,
  DecisionTimeline, AgentLoopIndicator, ProgressTracker, AdaptationPanel
} from '../components/ui';

// Floating Extract Button Component
const FloatingExtractButton = ({ onClick, isExtracting, success }) => {
  return (
    <button
      onClick={onClick}
      disabled={isExtracting}
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-2 px-5 py-3 rounded-full
        font-medium text-sm shadow-2xl
        transition-all duration-300 transform hover:scale-105
        ${success 
          ? 'bg-green-500 text-white shadow-green-500/30' 
          : isExtracting 
            ? 'bg-slate-700 text-slate-300 cursor-wait'
            : 'bg-gradient-to-r from-accent-purple to-accent-teal text-white shadow-accent-purple/30 hover:shadow-accent-purple/50'
        }
        disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
      `}
    >
      {success ? (
        <>
          <CheckCircle2 size={18} />
          Updated ✓
        </>
      ) : isExtracting ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Extracting...
        </>
      ) : (
        <>
          <Zap size={18} />
          Extract Latest Data
        </>
      )}
    </button>
  );
};

// Enhanced Alerts Component with severity
const EnhancedAlerts = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  const severityConfig = {
    high: { icon: AlertTriangle, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
    medium: { icon: AlertTriangle, bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    low: { icon: Zap, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    info: { icon: CheckCircle2, bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400' }
  };

  return (
    <div className="space-y-3">
      {alerts.slice(0, 4).map((alert, idx) => {
        const config = severityConfig[alert.severity] || severityConfig[alert.type] || severityConfig.info;
        const Icon = config.icon;

        return (
          <div key={idx} className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
            <div className="flex items-start gap-3">
              <Icon size={18} className={`${config.text} shrink-0 mt-0.5`} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-sm">{alert.title}</h4>
                  <Badge type={alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'info'}>
                    {alert.severity || alert.type}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">{alert.message}</p>
                {alert.action && (
                  <p className="text-xs text-accent-teal mt-2 flex items-center gap-1">
                    <ChevronRight size={12} /> {alert.action}
                  </p>
                )}
                {alert.topic && (
                  <span className="inline-block text-[10px] px-2 py-0.5 bg-slate-800 rounded mt-2">
                    {alert.topic}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Next Steps Component from Adaptation
const NextStepsCard = ({ nextSteps }) => {
  if (!nextSteps || nextSteps.length === 0) return null;

  return (
    <Card className="p-5 bg-linear-to-br from-accent-teal/10 to-transparent border-accent-teal/20">
      <div className="flex items-center gap-2 mb-4">
        <ListOrdered size={18} className="text-accent-teal" />
        <h3 className="font-bold">Next Steps</h3>
      </div>
      <ol className="space-y-3">
        {nextSteps.slice(0, 5).map((step, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              idx === 0 ? 'bg-accent-teal text-dark-900' : 'bg-slate-800 text-slate-400'
            }`}>
              {idx + 1}
            </span>
            <div className="flex-1">
              <p className={`text-sm ${idx === 0 ? 'text-white font-medium' : 'text-slate-300'}`}>
                {step.action || step}
              </p>
              {step.priority && (
                <Badge type={step.priority === 'high' ? 'danger' : step.priority === 'medium' ? 'warning' : 'neutral'} className="mt-1">
                  {step.priority}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
};

// Dynamic Summary Component
const DynamicSummary = ({ data, agentState }) => {
  const diagnosis = agentState?.diagnosis || {};
  const monitoring = agentState?.progress || {};
  
  // Build dynamic summary based on actual data
  const summaryParts = [];
  
  if (data?.weak_topics?.length > 0) {
    summaryParts.push(`${data.weak_topics.length} area${data.weak_topics.length > 1 ? 's' : ''} need attention`);
    summaryParts.push(`Focus: ${data.weak_topics[0].topic.toLowerCase()}`);
  }
  
  if (diagnosis.confidence_level) {
    const levelText = diagnosis.confidence_level === 'high' ? 'Strong performance overall' :
                      diagnosis.confidence_level === 'medium' ? 'Room for improvement' :
                      diagnosis.confidence_level === 'low' ? 'Needs focused practice' :
                      'Rebuild fundamentals needed';
    summaryParts.push(levelText);
  }
  
  if (monitoring.summary) {
    summaryParts.push(monitoring.summary);
  }

  return (
    <Card className="bg-linear-to-br from-accent-purple/10 to-transparent border-accent-purple/20">
      <h3 className="font-bold mb-3 flex items-center gap-2 text-accent-purple">
        <BrainCircuit size={18} /> AI Summary
      </h3>
      <div className="space-y-2">
        {summaryParts.length > 0 ? (
          summaryParts.map((part, idx) => (
            <p key={idx} className="text-sm text-slate-400 leading-relaxed">
              {idx === 0 ? '📊 ' : idx === 1 ? '🎯 ' : '💡 '}{part}
            </p>
          ))
        ) : (
          <p className="text-sm text-slate-400 italic">Analysis complete.</p>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
        <span>Loops: {agentState?.agent_loop?.total_runs || 0}</span>
        <span className="text-accent-teal">
          Confidence: {diagnosis.confidence_level || 'N/A'}
        </span>
      </div>
    </Card>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    user, data, agentState, hasData, isWaitingForData, refreshData, 
    isPolling, setIsPolling, dataStatus, extractLatestData, loading 
  } = useApp();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] State:', { user, hasData, isWaitingForData, isPolling, dataStatus });
  }, [user, hasData, isWaitingForData, isPolling, dataStatus]);

  // Redirect if no user
  useEffect(() => {
    if (!user) {
      console.log('[Dashboard] No user, redirecting to landing');
      navigate('/');
    }
  }, [user, navigate]);

  // Handle extract latest data
  const handleExtractLatest = async () => {
    setIsExtracting(true);
    setExtractSuccess(false);
    try {
      // Open LeetCode in new tab
      const profileUrl = `https://leetcode.com/u/${user}/`;
      window.open(profileUrl, '_blank');
      
      // Start polling for new data
      setIsPolling(true);
      await extractLatestData();
      
      // Show success state briefly
      setExtractSuccess(true);
      setTimeout(() => setExtractSuccess(false), 3000);
    } catch (err) {
      console.error('[Dashboard] Extract failed:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Show waiting state ONLY if actively polling
  if (isWaitingForData && isPolling) {
    console.log('[Dashboard] Showing waiting state');
    return (
      <>
        <WaitingForData />
        <FloatingExtractButton 
          onClick={handleExtractLatest}
          isExtracting={isExtracting}
          success={extractSuccess}
        />
      </>
    );
  }

  // Show empty state with extract button - don't force extraction
  if (!hasData) {
    console.log('[Dashboard] Showing empty state - no data');
    return (
      <>
        <EmptyState
          title="Welcome to DebugMind AI"
          message="Click 'Extract Latest Data' to analyze your LeetCode profile and get personalized AI insights."
          icon={BrainCircuit}
          action={
            <button 
              onClick={handleExtractLatest}
              disabled={isExtracting}
              className="btn-primary inline-flex items-center gap-2"
            >
              {isExtracting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Extract Latest Data
                </>
              )}
            </button>
          }
        />
        <FloatingExtractButton 
          onClick={handleExtractLatest}
          isExtracting={isExtracting}
          success={extractSuccess}
        />
      </>
    );
  }

  console.log('[Dashboard] Rendering dashboard with data');

  // Extract adaptation next steps
  const adaptationNextSteps = agentState?.adaptation?.next_steps || [];
  const enhancedAlerts = agentState?.alerts || agentState?.progress?.alerts || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Agent Loop Status */}
      <AgentLoopIndicator
        currentStage={agentState?.agent_loop?.current_stage || 'complete'}
        stageDescription={agentState?.stage_description}
        isRunning={agentState?.agent_loop?.current_stage !== 'complete' && agentState?.agent_loop?.current_stage !== 'idle'}
      />

      {/* Enhanced Alerts with Severity */}
      {enhancedAlerts.length > 0 && <EnhancedAlerts alerts={enhancedAlerts} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Next Action - Prominent */}
          <NextActionCard nextAction={agentState?.next_action} />

          {/* Next Steps from Adaptation */}
          {adaptationNextSteps.length > 0 && (
            <NextStepsCard nextSteps={adaptationNextSteps} />
          )}

          {/* Weak Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.weak_topics?.map((t, i) => (
              <Card key={i} className="card-hover border-l-4 border-l-accent-purple">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{t.topic}</h3>
                  <Badge type={t.confidence < 40 ? "danger" : t.confidence < 60 ? "warning" : "info"}>
                    {t.confidence || t.score}%
                  </Badge>
                </div>
                <ProgressBar value={t.confidence || t.score} />
                <p className="text-sm text-slate-400 mt-4 line-clamp-2 italic">Goal: {t.goal}</p>
              </Card>
            ))}
          </div>

          {/* Strategy Evolution */}
          {agentState?.strategy_evolution && <StrategyEvolution evolution={agentState.strategy_evolution} />}

          {/* Adaptation Panel */}
          {agentState?.adaptation && <AdaptationPanel adaptation={agentState.adaptation} />}
        </div>

        <div className="space-y-6">
          <ProgressTracker progress={agentState?.progress} metrics={agentState?.metrics} />
          <DecisionTimeline decisions={agentState?.decision_timeline} />
          
          {/* Dynamic Summary */}
          <DynamicSummary data={data} agentState={agentState} />

          {/* Refresh Button */}
          <button 
            onClick={refreshData} 
            className="w-full p-3 rounded-xl border border-slate-700 hover:border-accent-teal hover:bg-accent-teal/5 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw size={16} /> Refresh Analysis
          </button>
        </div>
      </div>

      {/* Floating Extract Button */}
      <FloatingExtractButton 
        onClick={handleExtractLatest}
        isExtracting={isExtracting}
        success={extractSuccess}
      />
    </div>
  );
}
