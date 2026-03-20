import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Target, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Badge, GoalsPanel, LearningPlan, ConfidenceChart } from '../components/ui';

export default function Goals() {
  const navigate = useNavigate();
  const { user, hasData, agentState, advanceDay } = useApp();

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Goals & Learning Plan</h2>
          <p className="text-slate-400">Your personalized roadmap to mastery</p>
        </div>
        <Badge type="info">{agentState?.goals?.length || 0} active goals</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GoalsPanel goals={agentState?.goals} />
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
