import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, BrainCircuit, AlertTriangle, CheckCircle2, 
  Zap, ListOrdered, ChevronRight, Loader2, Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WaitingForData, EmptyState } from '../components/Loader';
import {
  Card, Badge, ProgressBar, SmartAlerts, NextActionCard, StrategyEvolution,
  DecisionTimeline, AgentLoopIndicator, ProgressTracker, AdaptationPanel
} from '../components/ui';

// Floating Extract Button Component — FIX 20 + STEP 8: Micro feedback with loadingMessage
const FloatingExtractButton = ({ onClick, isExtracting, success, loadingMessage }) => {
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
          Your progress has been updated ✓
        </>
      ) : isExtracting ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          {loadingMessage || 'Analyzing your latest submissions...'}
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
    isPolling, setIsPolling, dataStatus, extractLatestData, loading, loadingMessage,
    error, clearError, fetchAgentState
  } = useApp();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);

  // Polish 4: timeAgo helper for last updated
  const timeAgo = (date) => {
    if (!date) return null;
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

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

  // Generate progress trend info
  const metrics = data?.metrics || {};
  const progress = Number(metrics.total_submissions || 0) > 0 
    ? Math.min(100, Math.round((metrics.overall_success_rate || 0)))
    : 0;

  // Process and deduplicate weak topics
  const processedWeakTopics = React.useMemo(() => {
    const rawTopics = data?.weak_topics || [];
    const dedupMap = new Map();
    
    rawTopics.forEach(t => {
      let topic = t.topic || 'Concept Improvement';
      let goal = t.goal || t.strategy || t.description || '';
      
      const goalLower = goal.toLowerCase();
      if (goalLower.includes('lack of clear problem understanding')) {
        goal = 'Improve understanding of problem patterns and solution approach';
      } else if (goalLower.includes('no error handling') || goalLower.includes('edge case')) {
        goal = 'Practice handling edge cases like n = 0 or empty inputs';
      }

      if (topic === 'AI-Identified Skill Gap') {
        const stratLower = (t.strategy || t.description || '').toLowerCase();
        if (stratLower.includes('two pointer')) topic = 'Two Pointer Optimization';
        else if (stratLower.includes('dp') || stratLower.includes('dynamic')) topic = 'Dynamic Programming Improvement';
        else if (stratLower.includes('edge case')) topic = 'Edge Case Handling';
        else topic = 'Concept Improvement';
      }
      topic = topic.replace(/AI-Identified/g, '').trim();

      const key = `${topic}-${goal}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, { ...t, topic, goal });
      }
    });

    return Array.from(dedupMap.values());
  }, [data?.weak_topics]);

  // Handle extract latest data — Polish 2: Debounce with loading guard
  const handleExtractLatest = async () => {
    if (loading || isExtracting) return; // Debounce rapid clicks
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
          isExtracting={isExtracting || loading}
          success={extractSuccess}
          loadingMessage={loadingMessage}
        />
      </>
    );
  }

  // FIX 21: Show empty state with clear action steps
  if (!hasData) {
    console.log('[Dashboard] Showing empty state - no data');
    return (
      <>
        <div className="text-center py-16 animate-in fade-in duration-500">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-800 flex items-center justify-center">
            <BrainCircuit size={32} className="text-slate-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">Welcome to DebugMind AI</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            We'll analyze your LeetCode submissions and give you personalized AI insights.
          </p>
          <div className="max-w-sm mx-auto bg-slate-800/50 rounded-xl p-5 mb-6 text-left">
            <h4 className="text-sm font-bold text-accent-teal mb-3">How to get started:</h4>
            <ol className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">1</span>
                Solve a few problems on <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-accent-teal hover:underline">LeetCode</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0 text-xs font-bold">2</span>
                Click <strong className="text-white">"Extract Latest Data"</strong> below
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
                Your dashboard will populate automatically
              </li>
            </ol>
          </div>
          <button 
            onClick={handleExtractLatest}
            disabled={isExtracting}
            className="btn-primary inline-flex items-center gap-2"
          >
            {isExtracting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyzing your latest submissions...
              </>
            ) : (
              <>
                <Zap size={18} />
                Extract Latest Data
              </>
            )}
          </button>
        </div>
        <FloatingExtractButton 
          onClick={handleExtractLatest}
          isExtracting={isExtracting || loading}
          success={extractSuccess}
          loadingMessage={loadingMessage}
        />
      </>
    );
  }

  console.log('[Dashboard] Rendering dashboard with data');

  // Extract adaptation next steps
  const adaptationNextSteps = agentState?.adaptation?.next_steps || [];
  const enhancedAlerts = agentState?.alerts || agentState?.progress?.alerts || [];

  return (
    <div className="w-full max-w-none space-y-6 animate-in fade-in duration-500">
      {/* Polish 5: Retry on timeout error */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
          <button
            onClick={() => { clearError(); fetchAgentState(user); }}
            className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Agent Loop Status — Full width card */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Agent Loop</h3>
          {agentState?.lastUpdated && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={12} />
              Updated {timeAgo(agentState.lastUpdated)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-between w-full">
        <div className="w-full">
          <AgentLoopIndicator
            currentStage={agentState?.agent_loop?.current_stage || 'complete'}
            stageDescription={agentState?.stage_description}
            isRunning={agentState?.agent_loop?.current_stage !== 'complete' && agentState?.agent_loop?.current_stage !== 'idle'}
          />
        </div>
        </div>
      </div>

      {/* Enhanced Alerts with Severity */}
      {enhancedAlerts.length > 0 && <EnhancedAlerts alerts={enhancedAlerts} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Next Action - Prominent */}
          <NextActionCard nextAction={agentState?.next_action} />

          {/* Progress Trends - NEW */}
          {agentState?.progress_delta && (agentState.progress_delta.improvement?.length > 0 || agentState.progress_delta.decline?.length > 0 || agentState.progress_delta.unchanged?.length > 0) && (
            <Card className="border-l-4 border-l-accent-teal">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-accent-teal" />
                Recent Performance Trends
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {agentState.progress_delta.improvement?.length > 0 && (
                  <div className="space-y-3 bg-dark-900/30 p-3 rounded-lg border border-emerald-900/30">
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                      <span>📈</span> Improved Areas
                    </p>
                    <ul className="space-y-2">
                      {agentState.progress_delta.improvement.map((t, i) => (
                        <li key={i} className="text-sm text-slate-300 flex justify-between items-center">
                          <span className="truncate pr-2">{t.topic}</span>
                          <span className="text-emerald-400 font-medium px-2 py-0.5 bg-emerald-900/30 rounded text-xs">+{t.delta}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {agentState.progress_delta.decline?.length > 0 && (
                  <div className="space-y-3 bg-dark-900/30 p-3 rounded-lg border border-red-900/30">
                    <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
                      <span>⚠️</span> Needs Focus
                    </p>
                    <ul className="space-y-2">
                      {agentState.progress_delta.decline.map((t, i) => (
                        <li key={i} className="text-sm text-slate-300 flex justify-between items-center">
                          <span className="truncate pr-2">{t.topic}</span>
                          <span className="text-red-400 font-medium px-2 py-0.5 bg-red-900/30 rounded text-xs">{t.delta}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {agentState.progress_delta.unchanged?.length > 0 && (
                  <div className="space-y-3 bg-dark-900/30 p-3 rounded-lg border border-slate-700/30">
                    <p className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                      <span>⚖️</span> Progress Track
                    </p>
                    <ul className="space-y-2">
                      {agentState.progress_delta.unchanged.map((t, i) => (
                        <li key={i} className="text-sm text-slate-300 flex justify-between items-center">
                          <span className="truncate pr-2">{t.topic}</span>
                          {t.status === 'insufficient_data' ? (
                            <span className="text-slate-500 italic text-xs">Not enough data yet</span>
                          ) : (
                            <span className="text-slate-400 font-medium px-2 py-0.5 bg-slate-800/50 rounded text-xs">Stable ({t.currentScore}%)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Next Steps from Adaptation */}
          {adaptationNextSteps.length > 0 && (
            <NextStepsCard nextSteps={adaptationNextSteps} />
          )}

          {/* Weak Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processedWeakTopics.map((t, i) => (
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
        isExtracting={isExtracting || loading}
        success={extractSuccess}
        loadingMessage={loadingMessage}
      />
    </div>
  );
}
