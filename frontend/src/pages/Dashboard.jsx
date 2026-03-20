import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RefreshCw, BrainCircuit, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WaitingForData, EmptyState } from '../components/Loader';
import {
  Card, Badge, ProgressBar, SmartAlerts, NextActionCard, StrategyEvolution,
  DecisionTimeline, AgentLoopIndicator, ProgressTracker, AdaptationPanel
} from '../components/ui';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, data, agentState, hasData, isWaitingForData, refreshData, isPolling, setIsPolling, dataStatus } = useApp();

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

  // Start polling when dashboard loads if user exists
  useEffect(() => {
    if (user && !isPolling && !hasData) {
      console.log('[Dashboard] Starting polling for user:', user);
      setIsPolling(true);
    }
  }, [user, isPolling, hasData, setIsPolling]);

  // Show waiting state if polling but no data yet
  if (isWaitingForData || (isPolling && !hasData && dataStatus !== 'ready')) {
    console.log('[Dashboard] Showing waiting state');
    return <WaitingForData />;
  }

  // Show empty state if not polling and no data
  if (!hasData) {
    console.log('[Dashboard] Showing empty state - no data');
    return (
      <EmptyState
        title="No Analysis Yet"
        message="Start from the homepage to analyze your LeetCode profile and get personalized insights."
        icon={BrainCircuit}
        action={
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Go to Homepage <ArrowRight size={18} />
          </Link>
        }
      />
    );
  }

  console.log('[Dashboard] Rendering dashboard with data');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Agent Loop Status */}
      <AgentLoopIndicator
        currentStage={agentState?.agent_loop?.current_stage || 'complete'}
        stageDescription={agentState?.stage_description}
        isRunning={agentState?.agent_loop?.current_stage !== 'complete' && agentState?.agent_loop?.current_stage !== 'idle'}
      />

      {/* Smart Alerts */}
      {agentState?.alerts?.length > 0 && <SmartAlerts alerts={agentState.alerts} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Next Action - Prominent */}
          <NextActionCard nextAction={agentState?.next_action} />

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

          <Card className="bg-linear-to-br from-accent-purple/10 to-transparent border-accent-purple/20">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-accent-purple">
              <BrainCircuit size={18} /> Summary
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed italic">
              {data?.weak_topics?.[0]
                ? `${data.weak_topics.length} areas need attention. Focus: ${data.weak_topics[0].topic.toLowerCase()}.`
                : 'Analysis complete.'}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
              <span>Loops: {agentState?.agent_loop?.total_runs || 0}</span>
              <button onClick={refreshData} className="text-accent-teal hover:underline flex items-center gap-1">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
