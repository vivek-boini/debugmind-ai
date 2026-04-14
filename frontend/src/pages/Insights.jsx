import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Zap, AlertTriangle, ArrowRight, Brain, TrendingUp, TrendingDown, 
  Minus, Target, AlertCircle, Repeat, Languages, Clock, CheckCircle2 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, Badge, DecisionTimeline } from '../components/ui';

// Learning velocity badge component
const VelocityBadge = ({ velocity }) => {
  if (!velocity) return null;
  
  const config = {
    accelerating: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Accelerating' },
    improving: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Improving' },
    stable: { icon: Minus, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Stable' },
    slowing: { icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Slowing' },
    declining: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Declining' }
  };
  
  const { icon: Icon, color, bg, label } = config[velocity.direction] || config.stable;
  
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <Icon size={16} className={color} />
      <div>
        <span className={`text-sm font-semibold ${color}`}>{label}</span>
        {velocity.message && (
          <p className="text-xs text-slate-400 mt-0.5">{velocity.message}</p>
        )}
      </div>
    </div>
  );
};

// Pattern card component
const PatternCard = ({ pattern }) => {
  const iconMap = {
    early_abandonment: <AlertCircle size={18} className="text-amber-400" />,
    persistence: <CheckCircle2 size={18} className="text-emerald-400" />,
    language_switching: <Languages size={18} className="text-blue-400" />,
    default: <Repeat size={18} className="text-slate-400" />
  };
  
  return (
    <div className="p-4 bg-dark-900/50 rounded-xl border border-slate-800">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
          {iconMap[pattern.type] || iconMap.default}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm capitalize">{pattern.type?.replace(/_/g, ' ')}</h4>
          <p className="text-xs text-slate-400 mt-1">{pattern.description}</p>
          {pattern.recommendation && (
            <p className="text-xs text-accent-teal mt-2 italic">💡 {pattern.recommendation}</p>
          )}
          {pattern.affected_problems?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {pattern.affected_problems.slice(0, 3).map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800 rounded">{typeof p === 'string' ? p : p.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Confidence gap card
const ConfidenceGapCard = ({ gap }) => (
  <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
    <div className="flex items-center justify-between mb-2">
      <h4 className="font-semibold text-sm">{gap.topic}</h4>
      <Badge type="warning">Gap</Badge>
    </div>
    <p className="text-xs text-slate-400">{gap.description}</p>
    <div className="flex gap-4 mt-3">
      <div className="text-center">
        <div className="text-lg font-bold text-emerald-400">{gap.solved_count}</div>
        <div className="text-[9px] text-slate-500 uppercase">Solved</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-red-400">{gap.unsolved_count}</div>
        <div className="text-[9px] text-slate-500 uppercase">Unsolved</div>
      </div>
    </div>
    {gap.recommendation && (
      <p className="text-xs text-accent-teal mt-3 italic">💡 {gap.recommendation}</p>
    )}
  </div>
);

// Error pattern card
const ErrorPatternCard = ({ error }) => {
  const typeColors = {
    'Wrong Answer': 'text-red-400 bg-red-500/10 border-red-500/20',
    'Time Limit Exceeded': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'Runtime Error': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    'Memory Limit Exceeded': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    'Compile Error': 'text-pink-400 bg-pink-500/10 border-pink-500/20'
  };
  
  const colorClass = typeColors[error.type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  
  return (
    <div className={`p-4 rounded-xl border ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-sm">{error.type}</h4>
        <span className="text-xs font-bold">{error.count}x</span>
      </div>
      <p className="text-xs text-slate-400">{error.percentage}% of errors</p>
      {error.recommendation && (
        <p className="text-xs mt-2 italic opacity-80">💡 {error.recommendation}</p>
      )}
      {error.affected_topics?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {error.affected_topics.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800/50 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
};

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

  // Extract diagnosis data
  const diagnosis = agentState?.diagnosis || data;
  const learningVelocity = diagnosis?.learning_velocity;
  const behavioralPatterns = diagnosis?.behavioral_patterns || [];
  const confidenceGaps = diagnosis?.confidence_gaps || [];
  const errorPatterns = diagnosis?.error_patterns || [];
  const confidenceLevel = diagnosis?.confidence_level;

  // Format and deduplicate weak topics
  const processedWeakTopics = React.useMemo(() => {
    const rawTopics = data.weak_topics || [];
    const dedupMap = new Map();
    
    rawTopics.forEach(t => {
      let topic = t.topic || 'Concept Improvement';
      let strategy = t.strategy || '';
      
      const stratLower = strategy.toLowerCase();
      if (stratLower.includes('lack of clear problem understanding')) {
        strategy = 'Improve understanding of problem patterns and solution approach';
      } else if (stratLower.includes('no error handling') || stratLower.includes('edge case')) {
        strategy = 'Practice handling edge cases like n = 0 or empty inputs';
      }
      
      if (topic === 'AI-Identified Skill Gap') {
        if (stratLower.includes('two pointer')) topic = 'Two Pointer Optimization';
        else if (stratLower.includes('dp') || stratLower.includes('dynamic')) topic = 'Dynamic Programming Improvement';
        else if (stratLower.includes('edge case')) topic = 'Edge Case Handling';
        else topic = 'Concept Improvement';
      }
      topic = topic.replace(/AI-Identified/g, '').trim();

      const key = `${topic}-${strategy}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, { ...t, topic, strategy });
      }
    });
    
    return Array.from(dedupMap.values());
  }, [data.weak_topics]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Conceptual Insights</h2>
          <p className="text-slate-400">Deep-dive into your learning patterns</p>
        </div>
        <Badge type="info">Agent Analysis</Badge>
      </div>

      {/* Learning Velocity & Confidence Level */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {learningVelocity && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain size={18} className="text-accent-purple" />
              <h3 className="font-bold">Learning Velocity</h3>
            </div>
            <VelocityBadge velocity={learningVelocity} />
            {learningVelocity.rate_change !== undefined && (
              <p className="text-xs text-slate-500 mt-3">
                Rate change: {learningVelocity.rate_change > 0 ? '+' : ''}{learningVelocity.rate_change}%
              </p>
            )}
          </Card>
        )}
        
        {confidenceLevel && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} className="text-accent-teal" />
              <h3 className="font-bold">Confidence Level</h3>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
              confidenceLevel === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
              confidenceLevel === 'medium' ? 'bg-blue-500/10 text-blue-400' :
              confidenceLevel === 'low' ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              <span className="text-lg font-bold capitalize">{confidenceLevel?.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Based on success rate and topic performance
            </p>
          </Card>
        )}
      </div>

      {/* Behavioral Patterns Section */}
      {behavioralPatterns.length > 0 && (
        <section>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Brain size={18} className="text-accent-purple" />
            Behavioral Patterns
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {behavioralPatterns.map((pattern, i) => (
              <PatternCard key={i} pattern={pattern} />
            ))}
          </div>
        </section>
      )}

      {/* Error Patterns Section */}
      {errorPatterns.length > 0 && (
        <section>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" />
            Common Mistakes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {errorPatterns.slice(0, 6).map((error, i) => (
              <ErrorPatternCard key={i} error={error} />
            ))}
          </div>
        </section>
      )}

      {/* Confidence Gaps Section */}
      {confidenceGaps.length > 0 && (
        <section>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-400" />
            Confidence Gaps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confidenceGaps.map((gap, i) => (
              <ConfidenceGapCard key={i} gap={gap} />
            ))}
          </div>
        </section>
      )}

      {/* Decision Timeline */}
      {agentState?.decision_timeline?.length > 0 && (
        <DecisionTimeline decisions={agentState.decision_timeline} />
      )}

      {/* Weak Topics Analysis */}
      <div className="grid grid-cols-1 gap-6">
        {processedWeakTopics.map((t, i) => (
          <Card key={i}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 lg:border-r border-slate-800 lg:pr-8">
                <Badge type="danger" className="mb-4">Focus Area</Badge>
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
          <div className="text-3xl font-bold text-amber-400">{errorPatterns.length}</div>
          <div className="text-xs text-slate-500 mt-1">Error Types</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-emerald-400">{agentState?.agent_loop?.total_runs || 0}</div>
          <div className="text-xs text-slate-500 mt-1">Agent Loops</div>
        </Card>
      </div>
    </div>
  );
}
