import React, { useState, useEffect, useMemo } from 'react';
import { 
  Code2, AlertTriangle, CheckCircle2, XCircle, Clock, Zap, 
  ChevronRight, Lightbulb, TrendingUp, Target,
  AlertCircle, ArrowRight, Copy, Check, GitCompare,
  Award, Brain, Layers, ArrowUpRight, ArrowDownRight,
  Sparkles, BookOpen, RefreshCw, AlertOctagon, Compass, Code
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Score badge colors
const getScoreColor = (score) => {
  if (score >= 8) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (score >= 4) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
};

// Status chip colors
const getStatusColor = (status) => {
  if (status?.toLowerCase().includes('accepted')) return 'bg-green-500/20 text-green-400';
  if (status?.toLowerCase().includes('wrong')) return 'bg-red-500/20 text-red-400';
  if (status?.toLowerCase().includes('time')) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-slate-500/20 text-slate-400';
};

// Difficulty badge colors
const getDifficultyColor = (difficulty) => {
  if (difficulty === 'Easy') return 'bg-green-500/20 text-green-400';
  if (difficulty === 'Medium') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
};

// ============================================================================
// ANALYSIS PARSER - Converts raw LLM text to structured data
// ============================================================================

function parseAnalysis(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Helper to extract single-line field
  const extractField = (label, text) => {
    const patterns = [
      new RegExp(`\\*\\*${label}\\*\\*[:\\s]*(.+?)(?=\\n\\*\\*|\\n\\d+\\.|$)`, 'is'),
      new RegExp(`${label}[:\\s]*(.+?)(?=\\n|$)`, 'i'),
      new RegExp(`\\d+\\.\\s*\\*\\*${label}\\*\\*[:\\s]*(.+?)(?=\\n|$)`, 'is'),
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/^\*\*|\*\*$/g, '').trim();
      }
    }
    return null;
  };

  // Helper to extract list items
  const extractList = (label, text) => {
    const patterns = [
      new RegExp(`\\*\\*${label}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*\\w|\\n\\d+\\.\\s*\\*\\*|$)`, 'i'),
      new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*\\w|\\n\\d+\\.\\s*\\*\\*|$)`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const content = match[1].trim();
        // Extract bullet points or numbered items
        const items = content.split(/\n/)
          .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
          .filter(line => line.length > 0 && !line.startsWith('**'));
        return items.length > 0 ? items : null;
      }
    }
    return null;
  };

  // Extract score (handle formats like "8/10", "Score: 8", etc.)
  const extractScore = (text) => {
    const patterns = [
      /\*\*Score\*\*[:\s]*(\d+)\/10/i,
      /Score[:\s]*(\d+)\/10/i,
      /(\d+)\/10/,
      /\*\*Score\*\*[:\s]*(\d+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  };

  return {
    // Single submission fields
    verdict: extractField('Verdict', text),
    score: extractScore(text),
    timeComplexity: extractField('Time Complexity', text),
    spaceComplexity: extractField('Space Complexity', text),
    issues: extractList("What's Wrong", text) || extractList('Issues', text) || extractList('Bugs', text),
    improvements: extractList('Improvements', text) || extractList('How to Improve', text) || extractList('Suggestions', text),
    insight: extractField('Key Insight', text) || extractField('Insight', text) || extractField('Main Learning', text),
    
    // Comparative analysis fields
    progression: extractField('Progression', text),
    whatChanged: extractList('What Changed', text),
    struggles: extractList('Struggles', text),
    mistakePattern: extractList('Mistake Pattern', text),
    learningInsight: extractField('Learning Insight', text),
    
    // NEW: Enhanced mentor fields
    keyChange: extractField('Key Change', text),
    confidenceGaps: extractList('Confidence Gaps', text) || extractList('Confidence Gap', text),
    nextPractice: extractList('Next Practice', text) || extractList('Recommended Practice', text),
    
    // Optimal approach (keep for insights)
    optimalApproach: extractField('Optimal Approach', text) || extractField('Best Approach', text),
    
    rawText: text,
  };
}

// Group submissions by problem title
function groupSubmissionsByProblem(submissions) {
  if (!submissions || !Array.isArray(submissions)) return [];
  
  const groups = submissions.reduce((acc, sub, originalIndex) => {
    const title = sub.title || 'Untitled Problem';
    if (!acc[title]) {
      acc[title] = {
        title,
        submissions: [],
      };
    }
    acc[title].submissions.push({ ...sub, originalIndex });
    return acc;
  }, {});

  // Issue 3 fix: Sort by latestSubmissionTime DESC (newest first)
  // Compute latestSubmissionTime = max(submissions[].timestamp) for each problem
  const result = Object.values(groups).map(problem => {
    // Find the latest timestamp among all submissions for this problem
    let latestTime = 0;
    problem.submissions.forEach(sub => {
      const ts = sub.timestamp ? 
        (typeof sub.timestamp === 'number' ? sub.timestamp * 1000 : new Date(sub.timestamp).getTime()) : 
        0;
      if (ts > latestTime) latestTime = ts;
    });
    problem.latestSubmissionTime = latestTime;
    return problem;
  });

  // Sort by latestSubmissionTime DESC (newest problems first)
  result.sort((a, b) => b.latestSubmissionTime - a.latestSubmissionTime);
  
  // IMPORTANT: Keep submissions in chronological order within each problem (oldest → latest)
  // This is useful for showing progression timeline
  result.forEach(problem => {
    problem.submissions.sort((a, b) => {
      const tsA = a.timestamp ? 
        (typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime() / 1000) : 
        0;
      const tsB = b.timestamp ? 
        (typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime() / 1000) : 
        0;
      return tsA - tsB; // oldest first within problem
    });
  });
  
  return result;
}

// Normalize status values from various sources
function normalizeStatus(status) {
  if (!status) return 'Other';
  
  const s = status.toLowerCase().trim();
  
  if (s.includes('accepted') || s === 'ac') return 'Accepted';
  if (s.includes('wrong')) return 'Wrong Answer';
  if (s.includes('time limit') || s === 'tle') return 'TLE';
  if (s.includes('runtime error') || s === 'rte') return 'Runtime Error';
  if (s.includes('memory limit') || s === 'mle') return 'MLE';
  if (s.includes('compile') || s === 'ce') return 'Compile Error';
  
  return 'Other';
}

// Get normalized status from submission (checks both status and statusDisplay)
function getSubmissionStatus(sub) {
  return normalizeStatus(sub.status || sub.statusDisplay);
}

// Get status summary for a problem group
function getStatusSummary(submissions) {
  const accepted = submissions.filter(s => getSubmissionStatus(s) === 'Accepted').length;
  const wrong = submissions.filter(s => getSubmissionStatus(s) === 'Wrong Answer').length;
  const tle = submissions.filter(s => getSubmissionStatus(s) === 'TLE').length;
  const other = submissions.length - accepted - wrong - tle;
  
  const parts = [];
  if (accepted > 0) parts.push(`${accepted} Accepted`);
  if (wrong > 0) parts.push(`${wrong} Wrong`);
  if (tle > 0) parts.push(`${tle} TLE`);
  if (other > 0) parts.push(`${other} Other`);
  
  return parts.join(' • ');
}

// Calculate learning trend from submissions
function calculateLearningTrend(submissions) {
  if (!submissions || submissions.length === 0) {
    return { trend: 'unknown', label: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-500/10' };
  }
  
  // Use normalized statuses
  const statuses = submissions.map(s => getSubmissionStatus(s));
  const firstStatus = statuses[0];
  const lastStatus = statuses[statuses.length - 1];
  
  const acceptedCount = statuses.filter(s => s === 'Accepted').length;
  const wrongCount = statuses.filter(s => s === 'Wrong Answer').length;
  const hasAccepted = acceptedCount > 0;
  const lastAccepted = lastStatus === 'Accepted';
  const firstAccepted = firstStatus === 'Accepted';
  const allWrong = statuses.every(s => s === 'Wrong Answer');
  
  if (submissions.length === 1) {
    if (lastAccepted) {
      return { trend: 'success', label: 'First Try Success', color: 'text-green-400', bg: 'bg-green-500/10', icon: Award };
    }
    return { trend: 'attempting', label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: RefreshCw };
  }
  
  // Multiple submissions
  if (!firstAccepted && lastAccepted) {
    return { trend: 'improving', label: 'Improving', color: 'text-green-400', bg: 'bg-green-500/10', icon: TrendingUp };
  }
  
  if (allWrong) {
    if (wrongCount >= 3) {
      return { trend: 'struggling', label: 'Struggling', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertOctagon };
    }
    return { trend: 'working', label: 'Working On It', color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: RefreshCw };
  }
  
  if (hasAccepted && !lastAccepted) {
    return { trend: 'regressed', label: 'Needs Review', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: AlertCircle };
  }
  
  if (acceptedCount > 1) {
    return { trend: 'mastered', label: 'Mastered', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Sparkles };
  }
  
  return { trend: 'improving', label: 'Improving', color: 'text-green-400', bg: 'bg-green-500/10', icon: TrendingUp };
}

// ============================================================================
// CODE DIFF UTILITY (Simple line-based diff)
// ============================================================================

function getSimpleCodeDiff(prevCode, currCode) {
  if (!prevCode || !currCode) return null;
  
  const prevLines = prevCode.split('\n');
  const currLines = currCode.split('\n');
  
  const diff = [];
  const maxLen = Math.max(prevLines.length, currLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const prevLine = prevLines[i] || '';
    const currLine = currLines[i] || '';
    
    if (prevLine === currLine) {
      diff.push({ type: 'same', value: currLine });
    } else if (!prevLines[i]) {
      diff.push({ type: 'added', value: currLine });
    } else if (!currLines[i]) {
      diff.push({ type: 'removed', value: prevLine });
    } else {
      diff.push({ type: 'removed', value: prevLine });
      diff.push({ type: 'added', value: currLine });
    }
  }
  
  return diff;
}

// ============================================================================
// SKELETON & LOADING COMPONENTS
// ============================================================================

function AnalysisSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-4">
        <div className="w-1/3 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-lg"></div>
          ))}
        </div>
        <div className="w-2/3 space-y-4">
          <div className="h-8 bg-slate-800 rounded w-3/4"></div>
          <div className="h-4 bg-slate-800 rounded w-1/2"></div>
          <div className="h-32 bg-slate-800 rounded"></div>
          <div className="h-24 bg-slate-800 rounded"></div>
          <div className="h-64 bg-slate-800 rounded"></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STRUCTURED ANALYSIS COMPONENTS
// ============================================================================

// Extract short Big-O notation from complexity string
function getShortComplexity(value) {
  if (!value) return null;
  // Extract O(...) pattern
  const match = value.match(/O\([^)]+\)/i);
  return match ? match[0] : value.substring(0, 15);
}

// Metric Card - For displaying single metrics with icons
function MetricCard({ icon: Icon, label, value, colorClass, isComplexity }) {
  if (!value) return null;
  
  // For complexity fields, show short form with full tooltip
  const displayValue = isComplexity ? getShortComplexity(value) : value;
  
  return (
    <div 
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colorClass} group relative`}
      title={value}
    >
      <Icon size={18} className="shrink-0" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-xs opacity-70">{label}</p>
        <p className="font-medium truncate">{displayValue}</p>
      </div>
      {/* Tooltip on hover for full value */}
      {value.length > 15 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-900 border border-slate-700 rounded-lg shadow-xl z-20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-xs text-slate-300">{value}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
        </div>
      )}
    </div>
  );
}

// Section Card - For issues/improvements lists
function SectionCard({ icon: Icon, title, items, colorClass, emptyText }) {
  if (!items || items.length === 0) {
    if (!emptyText) return null;
    return (
      <div className={`rounded-xl border p-5 ${colorClass}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon size={18} />
          <h4 className="font-semibold">{title}</h4>
        </div>
        <p className="text-sm opacity-70">{emptyText}</p>
      </div>
    );
  }
  
  return (
    <div className={`rounded-xl border p-5 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} />
        <h4 className="font-semibold">{title}</h4>
        <span className="ml-auto text-xs opacity-60">{items.length} items</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <ChevronRight size={14} className="mt-1 shrink-0 opacity-60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Insight Card - For key insight display
function InsightCard({ insight }) {
  if (!insight) return null;
  
  return (
    <div className="p-5 bg-linear-to-r from-accent-purple/10 to-accent-teal/10 rounded-xl border border-accent-purple/30">
      <div className="flex items-center gap-2 mb-3">
        <Brain size={18} className="text-yellow-400" />
        <h4 className="font-semibold text-white">Key Insight</h4>
      </div>
      <p className="text-slate-300 leading-relaxed">{insight}</p>
    </div>
  );
}

// Structured Analysis Display - Main structured view
function StructuredAnalysisDisplay({ analysis, parsedAnalysis }) {
  const [showRaw, setShowRaw] = useState(false);
  
  // Use parsed data if available, fallback to analysis object
  const data = parsedAnalysis || {};
  const score = data.score || analysis.score;
  const verdict = data.verdict || analysis.verdict;
  const timeComplexity = data.timeComplexity || analysis.timeComplexity;
  const spaceComplexity = data.spaceComplexity || analysis.spaceComplexity;
  const issues = data.issues || analysis.whatsWrong || [];
  const improvements = data.improvements || analysis.howToImprove || [];
  const insight = data.insight || analysis.keyInsight;
  
  return (
    <div className="space-y-5">
      {/* Verdict */}
      {verdict && (
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Award size={18} className="text-accent-purple" />
            <h4 className="font-semibold text-accent-purple">Verdict</h4>
          </div>
          <p className="text-slate-200 italic">"{verdict}"</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard 
          icon={Target} 
          label="Score" 
          value={score ? `${score}/10` : null}
          colorClass={score ? getScoreColor(score) : 'bg-slate-800/50 border-slate-700 text-slate-400'}
        />
        <MetricCard 
          icon={Clock} 
          label="Time Complexity" 
          value={timeComplexity}
          colorClass="bg-blue-500/10 border-blue-500/30 text-blue-400"
          isComplexity={true}
        />
        <MetricCard 
          icon={Layers} 
          label="Space Complexity" 
          value={spaceComplexity}
          colorClass="bg-purple-500/10 border-purple-500/30 text-purple-400"
          isComplexity={true}
        />
        <MetricCard 
          icon={Zap} 
          label="Status" 
          value={analysis.status || analysis.statusDisplay}
          colorClass={getStatusColor(analysis.status || analysis.statusDisplay).replace('text-', 'text-').replace('bg-', 'bg-') + ' border-current/30'}
        />
      </div>

      {/* Issues & Improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard 
          icon={XCircle}
          title="Issues Found"
          items={issues}
          colorClass="bg-red-500/5 border-red-500/20 text-red-400"
          emptyText="No issues identified"
        />
        <SectionCard 
          icon={TrendingUp}
          title="Improvements"
          items={improvements}
          colorClass="bg-green-500/5 border-green-500/20 text-green-400"
          emptyText="No specific improvements suggested"
        />
      </div>

      {/* Key Insight */}
      <InsightCard insight={insight} />

      {/* Toggle Raw Text */}
      {data.rawText && (
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronRight size={14} className={`transition-transform ${showRaw ? 'rotate-90' : ''}`} />
            {showRaw ? 'Hide' : 'Show'} raw AI response
          </button>
          {showRaw && (
            <pre className="mt-3 p-4 bg-slate-900 rounded-lg text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap">
              {data.rawText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPARISON COMPONENTS
// ============================================================================

// Comparison Table for multiple submissions
function ComparisonTable({ submissions, analysisCache }) {
  if (!submissions || submissions.length < 2) return null;
  
  // Get cached analyses for submissions
  const analyses = submissions.map(sub => {
    const problemId = sub.id || sub.submissionId || `${sub.title}-${sub.originalIndex}`;
    const cached = analysisCache[problemId];
    const parsed = cached?.llmAnalysis ? parseAnalysis(cached.llmAnalysis) : null;
    return { sub, cached, parsed };
  });

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <GitCompare size={18} className="text-accent-teal" />
          <h4 className="font-semibold text-white">Submission Comparison</h4>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Metric</th>
              {submissions.map((sub, i) => (
                <th key={i} className="px-4 py-3 text-left text-slate-300 font-medium">
                  Submission {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-400">Status</td>
              {analyses.map(({ sub }, i) => (
                <td key={i} className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(sub.status)}`}>
                    {sub.status || sub.statusDisplay || 'Unknown'}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Language</td>
              {analyses.map(({ sub }, i) => (
                <td key={i} className="px-4 py-3 text-slate-300">{sub.lang || 'N/A'}</td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Score</td>
              {analyses.map(({ parsed }, i) => (
                <td key={i} className="px-4 py-3">
                  {parsed?.score ? (
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getScoreColor(parsed.score)}`}>
                      {parsed.score}/10
                    </span>
                  ) : (
                    <span className="text-slate-500">Not analyzed</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Time Complexity</td>
              {analyses.map(({ parsed }, i) => (
                <td key={i} className="px-4 py-3 text-blue-400">
                  {parsed?.timeComplexity || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Space Complexity</td>
              {analyses.map(({ parsed }, i) => (
                <td key={i} className="px-4 py-3 text-purple-400">
                  {parsed?.spaceComplexity || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Issues</td>
              {analyses.map(({ parsed }, i) => (
                <td key={i} className="px-4 py-3 text-red-400">
                  {parsed?.issues?.length || 0} found
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Comparison Insight - AI-generated comparison between submissions
function ComparisonInsight({ comparisonText }) {
  if (!comparisonText) return null;
  
  return (
    <div className="p-5 bg-linear-to-r from-accent-teal/10 to-accent-purple/10 rounded-xl border border-accent-teal/30">
      <div className="flex items-center gap-2 mb-3">
        <GitCompare size={18} className="text-accent-teal" />
        <h4 className="font-semibold text-white">Progression Analysis</h4>
      </div>
      <div className="prose prose-invert prose-sm max-w-none">
        <pre className="whitespace-pre-wrap text-slate-300 font-sans text-sm leading-relaxed">
          {comparisonText}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// COMPARATIVE ANALYSIS DISPLAY - Main component for multi-submission analysis
// ============================================================================

// Enhanced Timeline Item with tooltip
function TimelineItem({ submission, index, total }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const status = (submission.status || submission.statusDisplay || 'Unknown').toLowerCase();
  const isAccepted = status.includes('accepted');
  const isWrong = status.includes('wrong');
  const isLast = index === total - 1;
  
  const getStatusIcon = () => {
    if (isAccepted) return CheckCircle2;
    if (isWrong) return XCircle;
    return AlertCircle;
  };
  
  const StatusIcon = getStatusIcon();
  
  return (
    <div 
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Timeline node */}
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
        ${isAccepted ? 'bg-green-500/20 border border-green-500/30' : 
          isWrong ? 'bg-red-500/20 border border-red-500/30' : 
          'bg-yellow-500/20 border border-yellow-500/30'}
        ${isLast ? 'ring-2 ring-offset-2 ring-offset-dark-900 ring-accent-purple/50' : ''}
        hover:scale-105 cursor-default
      `}>
        <StatusIcon size={16} className={
          isAccepted ? 'text-green-400' : isWrong ? 'text-red-400' : 'text-yellow-400'
        } />
        <span className={`text-sm font-medium ${
          isAccepted ? 'text-green-400' : isWrong ? 'text-red-400' : 'text-yellow-400'
        }`}>
          #{index + 1}
        </span>
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-900 border border-slate-700 rounded-lg shadow-xl z-10 whitespace-nowrap animate-fade-in">
          <div className="text-xs text-slate-400 mb-1">Attempt {index + 1}</div>
          <div className={`text-sm font-medium ${
            isAccepted ? 'text-green-400' : isWrong ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {submission.status || submission.statusDisplay}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {submission.lang || submission.language || 'Unknown language'}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
        </div>
      )}
    </div>
  );
}

// Learning Trend Badge
function LearningTrendBadge({ submissions }) {
  const trend = calculateLearningTrend(submissions);
  const TrendIcon = trend.icon || TrendingUp;
  
  return (
    <div className={`
      inline-flex items-center gap-2 px-4 py-2 rounded-full
      ${trend.bg} border border-current/20
      animate-fade-in
    `}>
      <TrendIcon size={18} className={trend.color} />
      <span className={`font-semibold ${trend.color}`}>{trend.label}</span>
    </div>
  );
}

function ComparativeAnalysisDisplay({ 
  analysis, 
  parsedAnalysis, 
  onAnalyzeSingle,
  onGenerateSolution,
  generatedSolution,
  loadingSolution
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [activeTab, setActiveTab] = useState('journey'); // 'journey' or 'submissions'
  const [activeAttempt, setActiveAttempt] = useState(null); // FIX 3: Accordion state
  
  const data = parsedAnalysis || {};
  const submissions = analysis.submissions || [];
  const isMultiSubmission = submissions.length > 1;
  const trend = calculateLearningTrend(submissions);
  const TrendIcon = trend.icon || TrendingUp;

  // FIX 3: Accordion toggle handler
  const handleAttemptToggle = (index) => {
    setActiveAttempt(prev => prev === index ? null : index);
  };

  // Handle generate solution click
  const handleGenerateClick = () => {
    if (onGenerateSolution && analysis.title) {
      onGenerateSolution({ title: analysis.title, submissions });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Learning Trend */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${trend.bg}`}>
            <TrendIcon size={24} className={trend.color} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Learning Journey</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-400">{submissions.length} attempt{submissions.length > 1 ? 's' : ''}</span>
              <span className="text-slate-600">•</span>
              <span className={`text-sm font-medium ${trend.color}`}>{trend.label}</span>
            </div>
          </div>
        </div>
        
        {/* Tab switcher */}
        {isMultiSubmission && (
          <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('journey')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                activeTab === 'journey' 
                  ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Journey
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                activeTab === 'submissions' 
                  ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Submissions
            </button>
          </div>
        )}
      </div>

      {activeTab === 'journey' ? (
        <div className="space-y-4">
          {/* Enhanced Progression Timeline */}
          {isMultiSubmission && (
            <div className="p-5 bg-linear-to-r from-slate-800/50 to-slate-800/30 rounded-xl border border-slate-700 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-accent-teal" />
                <h4 className="font-semibold text-accent-teal">Progression Timeline</h4>
              </div>
              
              {/* Enhanced timeline with icons */}
              <div className="flex items-center gap-3 flex-wrap">
                {submissions.map((sub, i) => (
                  <React.Fragment key={i}>
                    <TimelineItem 
                      submission={sub} 
                      index={i} 
                      total={submissions.length} 
                    />
                    {i < submissions.length - 1 && (
                      <ArrowRight size={18} className="text-slate-500" />
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              {/* Progression summary */}
              {data.progression && (
                <p className="mt-4 text-slate-300 text-sm border-t border-slate-700/50 pt-4 leading-relaxed">
                  {data.progression}
                </p>
              )}
            </div>
          )}

          {/* Key Change Highlight - NEW */}
          {data.keyChange && (
            <div className="p-5 bg-linear-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/30 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-emerald-400" />
                <h4 className="font-semibold text-emerald-400">Key Breakthrough</h4>
              </div>
              <p className="text-slate-200 leading-relaxed">{data.keyChange}</p>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
            <MetricCard 
              icon={Target} 
              label="Final Score" 
              value={data.score ? `${data.score}/10` : null}
              colorClass={data.score ? getScoreColor(data.score) : 'bg-slate-800/50 border-slate-700 text-slate-400'}
            />
            <MetricCard 
              icon={Clock} 
              label="Time Complexity" 
              value={data.timeComplexity}
              colorClass="bg-blue-500/10 border-blue-500/30 text-blue-400"
              isComplexity={true}
            />
            <MetricCard 
              icon={Layers} 
              label="Space Complexity" 
              value={data.spaceComplexity}
              colorClass="bg-purple-500/10 border-purple-500/30 text-purple-400"
              isComplexity={true}
            />
          </div>

          {/* What Changed */}
          {data.whatChanged && data.whatChanged.length > 0 && (
            <SectionCard 
              icon={GitCompare}
              title="What Changed Between Attempts"
              items={data.whatChanged}
              colorClass="bg-accent-teal/5 border-accent-teal/20 text-accent-teal"
            />
          )}

          {/* Confidence Gaps - NEW */}
          {data.confidenceGaps && data.confidenceGaps.length > 0 && (
            <div className="p-5 bg-amber-500/5 rounded-xl border border-amber-500/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={18} className="text-amber-400" />
                <h4 className="font-semibold text-amber-400">Confidence Gaps</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.confidenceGaps.map((gap, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-sm text-amber-300"
                  >
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Struggles */}
          {data.struggles && data.struggles.length > 0 && (
            <SectionCard 
              icon={AlertTriangle}
              title="Struggles Identified"
              items={data.struggles}
              colorClass="bg-orange-500/5 border-orange-500/20 text-orange-400"
            />
          )}

          {/* Mistake Pattern */}
          {data.mistakePattern && data.mistakePattern.length > 0 && (
            <SectionCard 
              icon={RefreshCw}
              title="Repeated Mistake Patterns"
              items={data.mistakePattern}
              colorClass="bg-red-500/5 border-red-500/20 text-red-400"
            />
          )}

          {/* Next Practice Recommendations - NEW */}
          {data.nextPractice && data.nextPractice.length > 0 && (
            <div className="p-5 bg-linear-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/30 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Compass size={18} className="text-blue-400" />
                <h4 className="font-semibold text-blue-400">Next Practice Focus</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.nextPractice.map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg text-sm text-blue-200"
                  >
                    <Target size={14} className="text-blue-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning Insight */}
          {data.learningInsight && (
            <div className="p-5 bg-linear-to-r from-accent-purple/10 to-accent-teal/10 rounded-xl border border-accent-purple/30 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={18} className="text-yellow-400" />
                <h4 className="font-semibold text-white">What You Learned</h4>
              </div>
              <p className="text-slate-300 leading-relaxed">{data.learningInsight}</p>
            </div>
          )}

          {/* FIX 5: Optimal Approach Section */}
          {data.optimalApproach && (
            <div className="p-5 bg-linear-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/30 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Award size={18} className="text-cyan-400" />
                <h4 className="font-semibold text-white">💡 Optimal Approach</h4>
              </div>
              <p className="text-slate-300 leading-relaxed">{data.optimalApproach}</p>
            </div>
          )}

          {/* Generate Optimal Solution Section */}
          <div className="p-5 bg-linear-to-r from-emerald-500/5 to-teal-500/5 rounded-xl border border-emerald-500/20 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code size={18} className="text-emerald-400" />
                <h4 className="font-semibold text-white">💻 Optimal Solution</h4>
              </div>
              {!generatedSolution && (
                <button
                  onClick={handleGenerateClick}
                  disabled={loadingSolution}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                    loadingSolution 
                      ? 'bg-slate-700 text-slate-400 cursor-wait'
                      : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                  }`}
                >
                  {loadingSolution ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate Optimal Code
                    </>
                  )}
                </button>
              )}
            </div>
            
            {/* Loading state */}
            {loadingSolution && !generatedSolution && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <RefreshCw size={32} className="animate-spin text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-400">Generating optimal solution...</p>
                  <p className="text-xs text-slate-500 mt-1">This may take a few seconds</p>
                </div>
              </div>
            )}

            {/* Generated solution display - IMPROVED UI */}
            {generatedSolution && (
              <div className="space-y-4">
                {generatedSolution.solution ? (
                  <div className="space-y-4">
                    {/* Code Block with proper styling */}
                    <div className="rounded-xl border border-slate-700 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                          <span className="ml-2 text-xs text-slate-400 font-medium">
                            {generatedSolution.language || 'Code'}
                          </span>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedSolution.solution)}
                          className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                          title="Copy code"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="bg-dark-900 overflow-hidden">
                        <pre className="p-4 overflow-x-auto overflow-y-auto max-h-[350px] text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                          <code className="text-slate-300 font-mono">{generatedSolution.solution}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Complexity Metrics - Grid layout */}
                    {generatedSolution.explanation && (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Extract time complexity if mentioned */}
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock size={14} className="text-blue-400" />
                            <span className="text-xs text-blue-400 font-medium">Time</span>
                          </div>
                          <p className="text-sm text-slate-300 font-mono truncate" title={generatedSolution.explanation.match(/O\([^)]+\)/)?.[0] || 'See explanation'}>
                            {generatedSolution.explanation.match(/O\([^)]+\)/)?.[0] || 'Optimal'}
                          </p>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Layers size={14} className="text-purple-400" />
                            <span className="text-xs text-purple-400 font-medium">Space</span>
                          </div>
                          <p className="text-sm text-slate-300 font-mono truncate" title="See explanation">
                            {generatedSolution.explanation.match(/O\([^)]+\)/g)?.[1] || 'Optimal'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Explanation section - cleaned of complexity text */}
                    {generatedSolution.explanation && (
                      <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb size={14} className="text-yellow-400" />
                          <span className="text-xs text-yellow-400 font-medium">Explanation</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {generatedSolution.explanation
                            .replace(/\*\*/g, '')
                            .replace(/^[#\s\d\.]*\**(Explanation)\**:?\s*/i, '')
                            .replace(/\d+\.\s*\**(Time|Space)\s*Complexity\**:?\s*O\([^)]+\)[^.]*\.?/gi, '')
                            .replace(/Time\s*Complexity:?\s*O\([^)]+\)[^.]*\.?/gi, '')
                            .replace(/Space\s*Complexity:?\s*O\([^)]+\)[^.]*\.?/gi, '')
                            .replace(/O\([\w\s\*\^]+\)\s*(time|space)?/gi, '')
                            .replace(/\s{2,}/g, ' ')
                            .trim()}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <AlertCircle size={24} className="mx-auto mb-2 text-slate-500" />
                    <p>{generatedSolution.explanation || 'Unable to generate solution. Please try again.'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Initial prompt when no solution generated */}
            {!generatedSolution && !loadingSolution && (
              <p className="text-sm text-slate-500">
                Click the button above to generate an optimal solution based on your submissions.
              </p>
            )}
          </div>

          {/* Fallback to single submission fields if no comparative data */}
          {!isMultiSubmission && (
            <>
              {data.issues && data.issues.length > 0 && (
                <SectionCard 
                  icon={XCircle}
                  title="Issues Found"
                  items={data.issues}
                  colorClass="bg-red-500/5 border-red-500/20 text-red-400"
                />
              )}
              {data.improvements && data.improvements.length > 0 && (
                <SectionCard 
                  icon={TrendingUp}
                  title="Improvements"
                  items={data.improvements}
                  colorClass="bg-green-500/5 border-green-500/20 text-green-400"
                />
              )}
              {data.insight && <InsightCard insight={data.insight} />}
            </>
          )}
        </div>
      ) : (
        /* Submissions Tab - IMPROVED Accordion UI */
        <div className="space-y-3 animate-fade-in">
          {submissions.map((sub, i) => {
            const status = getSubmissionStatus(sub);
            const isAccepted = status === 'Accepted';
            const isOpen = activeAttempt === i;
            const prevSub = i > 0 ? submissions[i - 1] : null;
            const hasDiff = prevSub?.code && sub.code;
            
            return (
              <div 
                key={i} 
                className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                  isAccepted 
                    ? 'bg-green-500/5 border-green-500/30' 
                    : 'bg-slate-800/30 border-slate-700/50'
                } ${isOpen ? 'ring-2 ring-accent-purple/40 shadow-lg shadow-accent-purple/5' : 'hover:border-slate-600'}`}
              >
                {/* Accordion Header - Clean layout */}
                <button
                  onClick={() => handleAttemptToggle(i)}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${isAccepted ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {isAccepted ? (
                        <CheckCircle2 size={16} className="text-green-400" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-white">Attempt #{i + 1}</span>
                      {hasDiff && !isOpen && (
                        <span className="ml-2 text-xs text-accent-teal">• has changes</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      isAccepted 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400 font-mono">
                      {sub.lang || sub.language || 'Code'}
                    </span>
                    <ChevronRight 
                      size={18} 
                      className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} 
                    />
                  </div>
                </button>
                
                {/* Accordion Content - Collapsible with smooth animation */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-4 animate-fade-in border-t border-slate-700/30">
                    {/* Code Diff Section - Only shown once, clean format */}
                    {hasDiff && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <GitCompare size={14} className="text-accent-teal" />
                          <span className="text-sm text-accent-teal font-medium">
                            Changes from Attempt #{i}
                          </span>
                          <span className="text-xs text-slate-500">
                            (showing key differences)
                          </span>
                        </div>
                        <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                          <div className="max-h-40 overflow-y-auto bg-dark-900/80">
                            {(() => {
                              const diffLines = getSimpleCodeDiff(prevSub.code, sub.code) || [];
                              const changedLines = diffLines.filter(l => l.type !== 'same').slice(0, 15);
                              
                              if (changedLines.length === 0) {
                                return (
                                  <div className="p-3 text-xs text-slate-500 text-center">
                                    No significant changes detected
                                  </div>
                                );
                              }
                              
                              return changedLines.map((line, idx) => (
                                <div 
                                  key={idx} 
                                  className={`px-3 py-1 font-mono text-xs border-l-2 ${
                                    line.type === 'added' 
                                      ? 'bg-green-500/10 text-green-400 border-green-500' 
                                      : 'bg-red-500/10 text-red-400 border-red-500 opacity-70'
                                  }`}
                                >
                                  <span className="select-none opacity-60 mr-3 inline-block w-3">
                                    {line.type === 'added' ? '+' : '-'}
                                  </span>
                                  <span className={line.type === 'removed' ? 'line-through' : ''}>
                                    {line.value.substring(0, 80)}{line.value.length > 80 ? '...' : ''}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Code Block - Clean with proper scroll */}
                    {sub.code && (
                      <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 border-b border-slate-700/50">
                          <span className="text-xs text-slate-400">Source Code</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(sub.code);
                            }}
                            className="p-1 rounded hover:bg-slate-700 transition-colors text-slate-500 hover:text-white"
                            title="Copy code"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="bg-dark-900 overflow-hidden">
                          <pre className="p-3 overflow-x-auto overflow-y-auto max-h-52 text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
                            <code className="text-slate-400 font-mono">
                              {sub.code.substring(0, 1200)}
                              {sub.code.length > 1200 && (
                                <span className="text-slate-600">... (truncated)</span>
                              )}
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {/* Analyze Single Submission Button */}
                    {onAnalyzeSingle && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAnalyzeSingle(sub); }}
                        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-accent-purple hover:bg-accent-purple/10 transition-colors border border-accent-purple/30"
                      >
                        <Zap size={12} />
                        Analyze this submission individually
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toggle Raw Text */}
      {data.rawText && (
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronRight size={14} className={`transition-transform ${showRaw ? 'rotate-90' : ''}`} />
            {showRaw ? 'Hide' : 'Show'} raw AI response
          </button>
          {showRaw && (
            <pre className="mt-3 p-4 bg-slate-900 rounded-lg text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap animate-fade-in">
              {data.rawText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LEFT PANEL - GROUPED PROBLEM LIST
// ============================================================================

// Grouped Problem Item with Learning Trend
function GroupedProblemItem({ 
  problem, 
  isSelected, 
  isExpanded, 
  onToggle, 
  analysisCache 
}) {
  const hasMultiple = problem.submissions.length > 1;
  const statusSummary = getStatusSummary(problem.submissions);
  
  // Check if problem is cached (by problem title)
  const cacheKey = `problem:${problem.title}`;
  const isCached = !!analysisCache[cacheKey];
  
  // Get learning trend
  const trend = calculateLearningTrend(problem.submissions);
  const TrendIcon = trend.icon || TrendingUp;
  
  // FIX 1: Use normalized status to correctly detect "Solved"
  const hasAccepted = problem.submissions.some(s => getSubmissionStatus(s) === 'Accepted');
  
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-xl border transition-all duration-200 ${
        isSelected 
          ? 'bg-accent-purple/10 border-accent-purple/50 shadow-lg shadow-accent-purple/5' 
          : 'bg-dark-800 border-slate-800 hover:border-slate-700 hover:bg-dark-800/80'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white truncate flex items-center gap-2">
              {problem.title}
              {isCached && (
                <CheckCircle2 size={14} className="text-green-400 shrink-0" title="Analyzed" />
              )}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-500">
                {problem.submissions.length} attempt{problem.submissions.length > 1 ? 's' : ''}
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-xs text-slate-500">{statusSummary}</span>
            </div>
            
            {/* Mini trend indicator for multi-submission */}
            {hasMultiple && (
              <div className={`flex items-center gap-1.5 mt-2 ${trend.color}`}>
                <TrendIcon size={12} />
                <span className="text-xs font-medium">{trend.label}</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            {hasAccepted ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
                Solved
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-medium">
                Unsolved
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// CODE VIEWER COMPONENT
// ============================================================================

// Code viewer with copy button
function CodeViewer({ code, language, title }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/60 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
          </div>
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400 font-mono">{language}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className="bg-dark-900 overflow-hidden">
        <pre className="p-4 overflow-x-auto overflow-y-auto max-h-[400px] text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <code className="text-slate-300 font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// DETAIL PANEL - RIGHT SIDE
// ============================================================================

// Enhanced Lazy Analysis Detail Panel
function LazyAnalysisDetail({ 
  analysis, 
  allSubmissions, 
  analysisCache, 
  onAnalyzeSingle,
  onGenerateSolution,
  generatedSolutions,
  loadingSolution 
}) {
  const [copied, setCopied] = useState(false);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Lightbulb size={48} className="mb-4 text-slate-600" />
        <p className="text-lg">Click a problem to analyze your learning journey</p>
        <p className="text-sm text-slate-600 mt-2">All submissions will be analyzed together</p>
      </div>
    );
  }

  const handleCopyAnalysis = () => {
    navigator.clipboard.writeText(analysis.llmAnalysis || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse the LLM analysis into structured data
  const parsedAnalysis = analysis.llmAnalysis ? parseAnalysis(analysis.llmAnalysis) : null;
  
  // Check if this is comparative analysis
  const isComparative = analysis.isComparative || (analysis.submissions && analysis.submissions.length > 1);

  return (
    <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] pr-2">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{analysis.title}</h2>
            {analysis.submissionCount && (
              <p className="text-sm text-slate-400 mt-1">
                {analysis.submissionCount} submission{analysis.submissionCount > 1 ? 's' : ''} analyzed
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAnalysis}
              className="p-2 rounded hover:bg-slate-700 transition-colors"
              title="Copy analysis"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-slate-400" />}
            </button>
            <span className={`text-xs px-2 py-1 rounded ${
              analysis.analysisSource === 'llm' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {analysis.analysisSource === 'llm' ? '🤖 AI' : '📋 Rule-based'}
            </span>
          </div>
        </div>
      </div>

      {/* Use ComparativeAnalysisDisplay for all analyses */}
      {parsedAnalysis ? (
        <ComparativeAnalysisDisplay 
          analysis={analysis} 
          parsedAnalysis={parsedAnalysis}
          onAnalyzeSingle={onAnalyzeSingle}
          onGenerateSolution={onGenerateSolution}
          generatedSolution={generatedSolutions?.[analysis.title]}
          loadingSolution={loadingSolution === analysis.title}
        />
      ) : (
        /* Fallback to raw display if parsing failed */
        <div className="p-6 bg-linear-to-r from-slate-800/80 to-slate-800/50 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={20} className="text-yellow-400" />
            <h3 className="font-semibold text-white">AI Analysis</h3>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-slate-300 font-sans text-sm leading-relaxed">
              {analysis.llmAnalysis}
            </pre>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
        Analyzed at: {analysis.analyzedAt ? new Date(analysis.analyzedAt).toLocaleString() : 'Just now'}
      </div>
    </div>
  );
}

// Main component
export default function CodeAnalysis() {
  const { user, hasData } = useApp();
  const [submissions, setSubmissions] = useState([]);  // Raw submissions list
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedProblemTitle, setSelectedProblemTitle] = useState(null);  // Track which problem group is selected
  const [expandedProblems, setExpandedProblems] = useState({});  // Track expanded problem groups
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);  // For per-problem LLM analysis
  const [error, setError] = useState(null);
  const [analysisCache, setAnalysisCache] = useState({});  // Cache LLM results
  const [currentAnalysis, setCurrentAnalysis] = useState(null);  // Currently displayed analysis
  
  // New state for solution generation
  const [generatedSolutions, setGeneratedSolutions] = useState({});
  const [loadingSolution, setLoadingSolution] = useState(null);

  // Group submissions by problem title
  const groupedProblems = useMemo(() => {
    return groupSubmissionsByProblem(submissions);
  }, [submissions]);

  // Calculate stats
  const uniqueProblemsCount = groupedProblems.length;
  const totalSubmissionsCount = submissions.length;

  // Fetch submissions list on page load (NO LLM calls)
  useEffect(() => {
    // Get user from context or localStorage
    const currentUser = user || localStorage.getItem('debugmind_user')?.toLowerCase();
    
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchSubmissions = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[CodeAnalysis] Fetching submissions for:', currentUser);
        
        // Fetch from agent-state endpoint
        const res = await fetch(`${API_BASE_URL}/agent-state/${currentUser}`);
        const data = await res.json();
        
        console.log('[CodeAnalysis] Response:', data.status, 'submissions:', data.submissions?.length || 0);
        
        if (data.status === 'ready' && data.submissions && data.submissions.length > 0) {
          setSubmissions(data.submissions);
        } else if (data.status === 'no_data') {
          // No data yet - that's okay, show empty state
          setSubmissions([]);
        } else {
          // Try code-analysis cache as fallback
          const cacheRes = await fetch(`${API_BASE_URL}/code-analysis/${currentUser}`);
          if (cacheRes.ok) {
            const cacheData = await cacheRes.json();
            setSubmissions(cacheData.submissions || []);
          }
        }
      } catch (err) {
        console.error('[CodeAnalysis] Error fetching submissions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user]);

  // Handle problem group toggle - NOW triggers comparative analysis
  const handleProblemToggle = (problemTitle) => {
    // Always trigger comparative analysis on click
    handleProblemClick(problemTitle);
  };

  // Handle problem click - analyze ALL submissions for this problem (COMPARATIVE ANALYSIS)
  const handleProblemClick = async (problemTitle) => {
    const problem = groupedProblems.find(p => p.title === problemTitle);
    if (!problem) {
      console.error('[CodeAnalysis] Problem not found:', problemTitle);
      return;
    }

    // Safety check for submissions
    if (!problem.submissions || problem.submissions.length === 0) {
      console.error('[CodeAnalysis] No submissions found for problem:', problemTitle);
      setCurrentAnalysis({
        title: problemTitle,
        submissions: [],
        llmAnalysis: 'No submissions found for this problem.',
        analysisSource: 'error'
      });
      return;
    }

    console.log('[CodeAnalysis] Analyzing problem:', problemTitle, 'with', problem.submissions.length, 'submissions');
    console.log('[CodeAnalysis] First submission keys:', Object.keys(problem.submissions[0] || {}));

    setSelectedProblemTitle(problemTitle);
    setSelectedIndex(null); // Clear individual selection
    
    // Expand the problem group
    setExpandedProblems(prev => ({
      ...prev,
      [problemTitle]: true
    }));

    // Check cache first - cache by problem title (not submission)
    const cacheKey = `problem:${problemTitle}`;
    if (analysisCache[cacheKey]) {
      setCurrentAnalysis(analysisCache[cacheKey]);
      return;
    }

    // Call LLM with ALL submissions for this problem
    setAnalyzing(true);
    setCurrentAnalysis(null);

    try {
      const res = await fetch(`${API_BASE_URL}/analyze-problem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          submissions: problem.submissions  // Send ALL submissions
        })
      });

      // Check for HTTP errors
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[CodeAnalysis] API error:', res.status, errorData);
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const analysisResult = {
        title: problemTitle,
        submissions: problem.submissions,
        submissionCount: problem.submissions.length,
        isComparative: data.isComparative,
        llmAnalysis: data.analysis,
        analysisSource: data.source,
        analyzedAt: new Date().toISOString()
      };

      setCurrentAnalysis(analysisResult);

      // Cache by problem title
      setAnalysisCache(prev => ({
        ...prev,
        [cacheKey]: analysisResult
      }));

    } catch (err) {
      console.error('[CodeAnalysis] Error analyzing problem:', err);
      setCurrentAnalysis({
        title: problemTitle,
        submissions: problem.submissions,
        llmAnalysis: 'Failed to analyze. Please try again.',
        analysisSource: 'error'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle single submission analysis (optional - for "Analyze Latest" button)
  const handleSingleSubmissionAnalysis = async (submission) => {
    const cacheKey = `single:${submission.id || submission.submissionId || submission.originalIndex}`;
    
    if (analysisCache[cacheKey]) {
      setCurrentAnalysis(analysisCache[cacheKey]);
      return;
    }

    setAnalyzing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/analyze-problem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: submission })  // Legacy single-submission format
      });

      const data = await res.json();

      const analysisResult = {
        ...submission,
        submissionCount: 1,
        isComparative: false,
        llmAnalysis: data.analysis,
        analysisSource: data.source,
        analyzedAt: new Date().toISOString()
      };

      setCurrentAnalysis(analysisResult);
      setAnalysisCache(prev => ({
        ...prev,
        [cacheKey]: analysisResult
      }));

    } catch (err) {
      console.error('[CodeAnalysis] Error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle generating optimal solution (separate from analysis)
  const handleGenerateSolution = async (problem) => {
    if (!problem || !problem.submissions || problem.submissions.length === 0) {
      console.error('[CodeAnalysis] No submissions to generate solution for');
      return;
    }

    // Check if already generated
    if (generatedSolutions[problem.title]) {
      return; // Already have solution
    }

    try {
      setLoadingSolution(problem.title);

      const res = await fetch(`${API_BASE_URL}/generate-solution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          submissions: problem.submissions,
          problemTitle: problem.title
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      setGeneratedSolutions(prev => ({
        ...prev,
        [problem.title]: data
      }));

    } catch (err) {
      console.error('[CodeAnalysis] Error generating solution:', err);
      setGeneratedSolutions(prev => ({
        ...prev,
        [problem.title]: { 
          solution: null, 
          explanation: 'Failed to generate solution. Please try again.',
          fallback: true 
        }
      }));
    } finally {
      setLoadingSolution(null);
    }
  };

  // Get current user for display
  const currentUser = user || localStorage.getItem('debugmind_user')?.toLowerCase();

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Please log in to view code analysis</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Code2 className="text-accent-purple" />
            Code Analysis
          </h1>
        </div>
        <AnalysisSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Code2 className="text-accent-purple" />
            Code Analysis
          </h1>
        </div>
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Submissions</h3>
          <p className="text-slate-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Code2 className="text-accent-purple" />
            Code Analysis
          </h1>
        </div>
        <div className="p-8 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
          <Code2 size={48} className="mx-auto text-slate-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Submissions Found</h3>
          <p className="text-slate-500 mb-4">
            Use the Chrome extension to extract your LeetCode submissions first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Code2 className="text-accent-purple" />
          Code Analysis
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
            <Target size={14} className="text-accent-purple" />
            <span className="text-slate-400">{uniqueProblemsCount} problems</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
            <Layers size={14} className="text-accent-teal" />
            <span className="text-slate-400">{totalSubmissionsCount} submissions</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-slate-400">{Object.keys(analysisCache).length} analyzed</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Grouped Problem List */}
        <div className="w-full lg:w-1/3 space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto pr-1">
          {groupedProblems.map((problem) => (
            <GroupedProblemItem
              key={problem.title}
              problem={problem}
              isSelected={selectedProblemTitle === problem.title}
              isExpanded={!!expandedProblems[problem.title]}
              onToggle={() => handleProblemToggle(problem.title)}
              analysisCache={analysisCache}
            />
          ))}
        </div>

        {/* Detail Panel */}
        <div className="w-full lg:w-2/3">
          <div className="card">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-purple mb-4"></div>
                <p className="text-lg">⏳ Analyzing learning journey...</p>
                <p className="text-sm text-slate-500 mt-2">Comparing all submissions</p>
              </div>
            ) : (
              <LazyAnalysisDetail 
                analysis={currentAnalysis}
                allSubmissions={submissions}
                analysisCache={analysisCache}
                onAnalyzeSingle={handleSingleSubmissionAnalysis}
                onGenerateSolution={handleGenerateSolution}
                generatedSolutions={generatedSolutions}
                loadingSolution={loadingSolution}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
