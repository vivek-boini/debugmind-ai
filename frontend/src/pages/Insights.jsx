import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, AlertTriangle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, Badge, DecisionTimeline } from '../components/ui';

export default function Insights() {
  const navigate = useNavigate();
  const { user, data, hasData, agentState } = useApp();

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  if (!hasData) {
    return (
      <EmptyState
        title="No Insights Available"
        message="Run an analysis to discover insights about your coding patterns."
        icon={Zap}
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
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Conceptual Insights</h2>
          <p className="text-slate-400">Deep-dive into identified patterns</p>
        </div>
        <Badge type="info">Agent Analysis</Badge>
      </div>

      {/* Decision Timeline */}
      {agentState?.decision_timeline?.length > 0 && (
        <DecisionTimeline decisions={agentState.decision_timeline} />
      )}

      {/* Weak Topics Analysis */}
      <div className="grid grid-cols-1 gap-6">
        {data.weak_topics?.map((t, i) => (
          <Card key={i}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 lg:border-r border-slate-800 lg:pr-8">
                <Badge type="danger" className="mb-4">Pattern Alert</Badge>
                <h3 className="text-xl font-bold mb-2">{t.topic}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">{t.strategy}</p>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{t.confidence || t.score}%</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Confidence</div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Evidence</h4>
                <div className="space-y-3">
                  {t.evidence?.map((e, idx) => (
                    <div key={idx} className="p-4 bg-dark-900/50 rounded-lg border border-slate-800 flex gap-4 items-start">
                      <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300">{e}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-accent-purple">{data.weak_topics?.length || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Weak Areas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-accent-teal">{agentState?.goals?.length || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Active Goals</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-amber-400">{agentState?.decision_timeline?.length || 0}</div>
          <div className="text-xs text-slate-500 mt-1">AI Decisions</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-emerald-400">{agentState?.agent_loop?.total_runs || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Agent Loops</div>
        </Card>
      </div>
    </div>
  );
}
