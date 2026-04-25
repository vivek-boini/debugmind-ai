import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Target, ExternalLink, ArrowRight, Lightbulb, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/Loader';
import { Card, Badge, NextActionCard } from '../components/ui';

// Enhanced problem card with reason
const ProblemCard = ({ problem, index }) => {
  const p = typeof problem === 'string' ? { title: problem } : problem;
  
  const difficultyConfig = {
    easy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    hard: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  };
  
  const config = difficultyConfig[p.difficulty] || difficultyConfig.medium;

  return (
    <Card className={`flex flex-col h-full card-hover group border-l-4 ${config.border}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-accent-teal group-hover:bg-accent-teal group-hover:text-dark-900 transition-all">
          <Target size={20} />
        </div>
        <div className="flex items-center gap-2">
          <Badge type={p.difficulty === 'easy' ? 'success' : p.difficulty === 'hard' ? 'danger' : 'warning'}>
            {p.difficulty || 'Medium'}
          </Badge>
          {p.priority && (
            <Badge type="info" className="text-[10px]">#{index + 1}</Badge>
          )}
        </div>
      </div>

      <h3 className="text-lg font-bold mb-2">{p.title || p.lc_id || p}</h3>
      
      {/* Topic/Focus */}
      {p.topic && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
          <BookOpen size={12} />
          <span>{p.topic}</span>
        </div>
      )}

      {/* Pattern/Focus info */}
      {(p.pattern || p.focus) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {p.pattern && (
            <span className="text-[10px] px-2 py-0.5 bg-accent-purple/10 text-accent-purple rounded">
              {p.pattern}
            </span>
          )}
          {p.focus && (
            <span className="text-[10px] px-2 py-0.5 bg-accent-teal/10 text-accent-teal rounded">
              {p.focus}
            </span>
          )}
        </div>
      )}

      {/* REASON - Most important */}
      {p.reason && (
        <div className="flex-1 p-3 bg-accent-purple/5 rounded-lg border border-accent-purple/20 mb-4">
          <div className="flex items-center gap-1 text-xs text-accent-purple font-semibold mb-1">
            <Lightbulb size={12} />
            Why this problem?
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{p.reason}</p>
        </div>
      )}

      {/* Default reason if none provided */}
      {!p.reason && p.topic && (
        <p className="text-sm text-slate-500 mb-4 flex-1 italic">
          Recommended to strengthen your {p.topic} skills
        </p>
      )}

      {!p.reason && !p.topic && (
        <p className="text-sm text-slate-500 mb-4 flex-1">
          Practice patterns with this problem.
        </p>
      )}

      <a
        href={p.url || `https://leetcode.com/problems/${(p.slug || p.title || p).toString().toLowerCase().replace(/\s+/g, '-')}/`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-slate-700 hover:bg-white hover:text-dark-900 font-bold text-xs transition-all uppercase tracking-widest"
      >
        Solve on LeetCode <ExternalLink size={14} />
      </a>
    </Card>
  );
};

// Personalization info section
const PersonalizationInfo = ({ notes, weakTopics, topError, sequencing, className = '' }) => {
  const insights = [];
  if (Array.isArray(weakTopics) && weakTopics.length > 0) {
    insights.push(`Weak topics targeted first: ${weakTopics.slice(0, 3).join(', ')}`);
  }
  if (topError) {
    insights.push(`Error-pattern focus: ${topError.error_type || topError.type} (${topError.count || 0} recent cases)`);
  }
  if (sequencing) {
    insights.push(sequencing);
  }
  if (Array.isArray(notes) && notes.length > 0) {
    insights.push(...notes.slice(0, 2));
  }
  if (insights.length === 0) return null;
  const renderInsight = (note) => {
    const text = String(note || '');
    const idx = text.indexOf(':');
    if (idx > 0) {
      const label = text.slice(0, idx).trim();
      const detail = text.slice(idx + 1).trim();
      return (
        <span>
          <span className="font-semibold text-slate-100">{label}:</span>{' '}
          <span className="text-slate-300">{detail}</span>
        </span>
      );
    }
    return <span className="text-slate-300">{text}</span>;
  };

  return (
    <Card className={`p-4 bg-linear-to-r from-accent-teal/5 to-transparent border-accent-teal/20 h-full ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-accent-teal" />
        <h3 className="font-semibold text-base">Why These Problems?</h3>
      </div>
      <ul className="space-y-2">
        {insights.slice(0, 4).map((note, idx) => (
          <li key={idx} className="text-sm leading-6 flex items-start gap-2">
            <span className="text-accent-teal">•</span>
            {renderInsight(note)}
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default function Recommendations() {
  const navigate = useNavigate();
  const { user, data, hasData, agentState, syncFreshState } = useApp();
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(12);

  // Canonical recommendations source (computed before any early return)
  const baseProblems = agentState?.recommendations || data?.recommended_problems || [];

  // FIX STEP 4: Remove location/route dependencies - only check auth state
  useEffect(() => {
    console.log('[Recommendations] Mount/Update', {
      hasData,
      recommendationsCount: data?.recommended_problems?.length || 0,
      recommendationsSample: data?.recommended_problems?.slice(0, 2)
    });
    if (!user) navigate('/');
  }, [user, navigate]); // FIXED: removed data?.recommended_problems dependency

  useEffect(() => {
    if (!user) return;
    console.log('[Recommendations Refresh]', {
      event: 'mount-sync',
      user,
      incomingUpdatedAt: agentState?.lastUpdated || null,
      incomingVersion: agentState?.version || null
    });
    syncFreshState(user);
  }, [user, syncFreshState]);

  useEffect(() => {
    console.log('[Recommendations Refresh]', {
      event: 'state-change',
      updatedAt: agentState?.lastUpdated || null,
      version: agentState?.version || null,
      recommendationsCount: data?.recommended_problems?.length || 0
    });
  }, [agentState?.lastUpdated, agentState?.version, data?.recommended_problems]);

  useEffect(() => {
    const byTopic = agentState?.progress?.by_topic || {};
    const dp = byTopic['Dynamic Programming'];
    console.log('[Recommendations Sync]', {
      updatedAt: agentState?.lastUpdated || null,
      version: agentState?.version || null,
      recommendationsCount: baseProblems.length,
      dp: dp ? { total: dp.total, accepted: dp.accepted, successRate: dp.successRate || dp.success_rate } : null
    });
  }, [agentState?.lastUpdated, agentState?.version, agentState?.progress?.by_topic, baseProblems.length]);

  if (!hasData) {
    return (
      <EmptyState
        title="No Recommendations Yet"
        message="Complete an analysis to get personalized problem recommendations."
        icon={BookOpen}
        action={
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            Start Analysis <ArrowRight size={18} />
          </Link>
        }
      />
    );
  }

  // Build richer recommendation set from existing data (agent recs + plan problems)
  const planProblems = (agentState?.plan?.plan || []).flatMap((day) =>
    (day?.items || day?.problems || []).map((item) => {
      const p = typeof item === 'string' ? { title: item } : item;
      return {
        ...p,
        title: p.title || p.name,
        slug: p.slug || p.titleSlug,
        titleSlug: p.titleSlug || p.slug,
        topic: p.topic || day?.topic || (typeof day?.focus === 'string' ? day.focus.split(' - ')[0] : undefined),
        difficulty: (p.difficulty || day?.difficulty || 'medium').toLowerCase(),
        focus: p.focus || day?.focus,
        source: 'plan'
      };
    })
  );

  const uniqueProblemMap = new Map();
  [...baseProblems, ...planProblems].forEach((item) => {
    const p = typeof item === 'string' ? { title: item } : item;
    const key = (p.titleSlug || p.slug || p.problemId || p.title || '').toString().toLowerCase().trim();
    if (!key) return;
    if (!uniqueProblemMap.has(key)) {
      uniqueProblemMap.set(key, p);
    }
  });
  const mergedProblems = Array.from(uniqueProblemMap.values());

  // Normalize difficulty labels to avoid mixed-case mismatches
  const normalizedProblems = mergedProblems.map((p) => {
    const obj = typeof p === 'string' ? { title: p } : p;
    return {
      ...obj,
      difficulty: (obj.difficulty || 'medium').toLowerCase()
    };
  });

  const weakTopicSet = new Set((agentState?.diagnosis?.weak_topics || []).map((wt) => wt.topic));
  const problemsWithObjective = normalizedProblems.map((p) => {
    const topic = p.topic || 'General';
    const objective = weakTopicSet.has(topic)
      ? 'weakness'
      : p.difficulty === 'hard'
        ? 'stretch'
        : 'reinforcement';
    return { ...p, objective };
  });

  const objectivePriority = { weakness: 0, reinforcement: 1, stretch: 2 };
  const orderedProblems = [...problemsWithObjective].sort((a, b) => {
    if (objectivePriority[a.objective] !== objectivePriority[b.objective]) {
      return objectivePriority[a.objective] - objectivePriority[b.objective];
    }
    return 0;
  });

  const topicOptions = ['ALL', ...new Set(orderedProblems.map((p) => p.topic).filter(Boolean))];

  console.log('[Recommendations] ✓ Problems count:', orderedProblems.length);
  // FIX STEP 7: Debug logging
  if (orderedProblems.length === 0) {
    console.warn('[Recommendations] ⚠️  WARNING: Recommendations count is 0!');
  }

  // Difficulty + topic filter
  const filteredByDifficulty = selectedDifficulty === 'ALL'
    ? orderedProblems
    : orderedProblems.filter((p) => p.difficulty === selectedDifficulty.toLowerCase());
  const filteredProblems = selectedTopic === 'ALL'
    ? filteredByDifficulty
    : filteredByDifficulty.filter((p) => (p.topic || 'General') === selectedTopic);
  const visibleProblems = filteredProblems.slice(0, visibleCount);

  // Counts per difficulty
  const counts = {
    ALL: orderedProblems.length,
    EASY: orderedProblems.filter((p) => p.difficulty === 'easy').length,
    MEDIUM: orderedProblems.filter((p) => p.difficulty === 'medium').length,
    HARD: orderedProblems.filter((p) => p.difficulty === 'hard').length,
  };

  // Get adaptation recommendations
  const adaptationRecs = agentState?.adaptation?.recommendations || [];
  const topWeakTopics = (agentState?.diagnosis?.weak_topics || []).slice(0, 3).map((w) => w.topic);
  const topErrorPattern = (agentState?.diagnosis?.error_patterns || [])[0];
  const sequencingSummary = (() => {
    const weaknessCount = orderedProblems.filter((p) => p.objective === 'weakness').length;
    const reinforcementCount = orderedProblems.filter((p) => p.objective === 'reinforcement').length;
    const stretchCount = orderedProblems.filter((p) => p.objective === 'stretch').length;
    return `Sequencing rationale: ${weaknessCount} weakness-targeted, ${reinforcementCount} reinforcement, ${stretchCount} stretch problems.`;
  })();
  const adaptiveSuggestions = (() => {
    const suggestions = [];
    if (topWeakTopics.length > 0) {
      suggestions.push({
        text: `Prioritize ${topWeakTopics.slice(0, 2).join(' and ')} first to address weakest areas`,
        priority: 'high'
      });
    }
    if (topErrorPattern?.error_type) {
      suggestions.push({
        text: `Include drills that target ${topErrorPattern.error_type} failure modes`,
        priority: 'medium'
      });
    }
    suggestions.push(...adaptationRecs.slice(0, 2));
    return suggestions.slice(0, 4);
  })();

  // Difficulty pill styles
  const pillStyles = {
    ALL: { active: 'bg-accent-purple text-white border-accent-purple', color: 'text-accent-purple' },
    EASY: { active: 'bg-emerald-500 text-white border-emerald-500', color: 'text-emerald-400' },
    MEDIUM: { active: 'bg-amber-500 text-white border-amber-500', color: 'text-amber-400' },
    HARD: { active: 'bg-red-500 text-white border-red-500', color: 'text-red-400' },
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Practice Strategy</h2>
          <p className="text-slate-400">Problems selected by the planning agent</p>
        </div>
        <Badge type="info">Showing {visibleProblems.length} of {filteredProblems.length} problems</Badge>
      </div>

      {/* Next Action Card */}
      {agentState?.next_action && <NextActionCard nextAction={agentState.next_action} />}

      {/* Top insights row */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
        <div className="lg:col-span-6">
          <PersonalizationInfo
            notes={agentState?.plan?.personalization}
            weakTopics={topWeakTopics}
            topError={topErrorPattern}
            sequencing={sequencingSummary}
            className="mb-0"
          />
        </div>
        <div className="lg:col-span-5">
          {/* Adaptation Recommendations */}
          {adaptiveSuggestions.length > 0 && (
            <Card className="p-4 border-l-4 border-l-amber-500 h-full">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-400" />
                <h3 className="font-semibold text-base">Adaptive Suggestions</h3>
              </div>
              <div className="space-y-2">
                {adaptiveSuggestions.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm leading-6">
                    <span className={`shrink-0 ${
                      rec.priority === 'high' ? 'text-red-400' :
                      rec.priority === 'medium' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      {rec.priority === 'high' ? '⚠️' : rec.priority === 'medium' ? '💡' : '→'}
                    </span>
                    <div>
                      <span className="text-slate-300">{rec.text}</span>
                      {rec.action && (
                        <span className="text-accent-teal ml-2">• {rec.action}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Difficulty Filter Pills */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Filter by Difficulty</p>
      <div className="flex flex-wrap gap-2">
        {['ALL', 'EASY', 'MEDIUM', 'HARD'].map(level => (
          <button
            key={level}
            onClick={() => setSelectedDifficulty(level)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 uppercase tracking-wider ${
              selectedDifficulty === level
                ? pillStyles[level].active
                : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {level === 'ALL' ? 'All Levels' : level.charAt(0) + level.slice(1).toLowerCase()}
            <span className={`ml-1.5 ${selectedDifficulty === level ? 'opacity-80' : 'opacity-50'}`}>({counts[level]})</span>
          </button>
        ))}
      </div>
      </div>

      {/* Topic Filter Pills */}
      {topicOptions.length > 1 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Filter by Topic</p>
        <div className="flex flex-wrap gap-2">
          {topicOptions.map((topic) => (
            <button
              key={topic}
              onClick={() => {
                setSelectedTopic(topic);
                setVisibleCount(12);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                selectedTopic === topic
                  ? 'bg-accent-teal text-dark-900 border-accent-teal'
                  : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <span>{topic === 'ALL' ? 'All Topics' : topic}</span>
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                selectedTopic === topic
                  ? 'bg-dark-900/40 text-dark-900/80'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {topic === 'ALL'
                  ? orderedProblems.length
                  : orderedProblems.filter((p) => (p.topic || 'General') === topic).length}
              </span>
            </button>
          ))}
        </div>
        </div>
      )}

      {/* Problems Grid */}
      {visibleProblems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleProblems.map((p, i) => (
            <ProblemCard key={i} problem={p} index={i} />
          ))}
        </div>
      ) : orderedProblems.length > 0 ? (
        <Card className="text-center py-12">
          <Target size={48} className="mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-bold mb-2">No matching problems</h3>
          <p className="text-slate-400">Try a different difficulty or topic filter.</p>
          <button
            onClick={() => {
              setSelectedDifficulty('ALL');
              setSelectedTopic('ALL');
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-sm hover:bg-slate-700 transition-colors"
          >
            Reset filters
          </button>
        </Card>
      ) : (
        <Card className="text-center py-12">
          <Target size={48} className="mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-bold mb-2">No Problems Assigned</h3>
          <p className="text-slate-400">Your learning plan will be populated once the agent completes analysis.</p>
        </Card>
      )}

      {filteredProblems.length > visibleProblems.length && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 12)}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-accent-teal hover:bg-accent-teal/5 text-sm transition-colors"
          >
            Load more problems
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center bg-linear-to-br from-emerald-500/10 to-transparent">
          <div className="text-2xl font-bold text-emerald-400">
            {counts.EASY}
          </div>
          <div className="text-xs text-slate-500 mt-1">Easy</div>
        </Card>
        <Card className="p-4 text-center bg-linear-to-br from-amber-500/10 to-transparent">
          <div className="text-2xl font-bold text-amber-400">
            {counts.MEDIUM}
          </div>
          <div className="text-xs text-slate-500 mt-1">Medium</div>
        </Card>
        <Card className="p-4 text-center bg-linear-to-br from-red-500/10 to-transparent">
          <div className="text-2xl font-bold text-red-400">
            {counts.HARD}
          </div>
          <div className="text-xs text-slate-500 mt-1">Hard</div>
        </Card>
      </div>

      {/* Today's Focus Summary */}
      {agentState?.plan?.plan?.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-accent-purple" />
            Focus Areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...new Set(agentState.plan.plan.map(item => item.focus))].slice(0, 6).map((focus, idx) => (
              <div key={idx} className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm">
                <span className="font-medium">{focus}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
