/**
 * Diagnosis Agent (Enhanced)
 * Deeply analyzes user submissions to identify weak topics, error patterns,
 * confidence gaps, and learning progression
 *
 * Input: { submissions: [...] }
 * Output: { weak_topics, error_patterns, confidence_gaps, struggling_problems, confidence_level, timestamp }
 */

// Topic classification based on LeetCode problem patterns
const TOPIC_KEYWORDS = {
  'Dynamic Programming': ['dp', 'dynamic', 'fibonacci', 'climbing', 'stairs', 'coin', 'knapsack', 'subset', 'house robber', 'longest', 'sequence', 'rob', 'max profit', 'min cost'],
  'Arrays & Hashing': ['array', 'hash', 'two sum', 'contains duplicate', 'anagram', 'group', 'topk', 'frequency', 'majority', 'product', 'rotate'],
  'Binary Search': ['binary search', 'search', 'rotated', 'sorted array', 'peak', 'minimum', 'koko', 'capacity', 'split'],
  'Sliding Window': ['sliding', 'window', 'substring', 'maximum', 'minimum', 'subarray', 'consecutive', 'longest repeating'],
  'Linked List': ['linked', 'list', 'reverse', 'merge', 'cycle', 'node', 'reorder', 'remove nth', 'copy'],
  'Trees': ['tree', 'binary tree', 'bst', 'traversal', 'inorder', 'preorder', 'postorder', 'depth', 'height', 'balanced', 'subtree', 'ancestor'],
  'Graphs': ['graph', 'bfs', 'dfs', 'island', 'course', 'clone', 'topological', 'pacific', 'atlantic', 'rotten'],
  'Backtracking': ['backtrack', 'permutation', 'combination', 'subset', 'n-queen', 'sudoku', 'palindrome partition', 'letter combinations'],
  'Stack & Queue': ['stack', 'queue', 'valid parentheses', 'bracket', 'min stack', 'daily temperatures', 'largest rectangle', 'car fleet'],
  'Greedy': ['greedy', 'interval', 'meeting', 'jump game', 'gas station', 'hand of straights', 'merge triplets', 'partition labels'],
  'Two Pointers': ['two pointer', 'three sum', '3sum', 'container', 'water', 'trapping rain', 'move zeroes'],
  'Heap/Priority Queue': ['heap', 'priority', 'kth largest', 'k closest', 'median', 'task scheduler', 'merge k'],
  'Bit Manipulation': ['bit', 'single number', 'missing number', 'reverse bits', 'counting bits'],
  'Math & Geometry': ['math', 'happy number', 'plus one', 'pow', 'sqrt', 'detect squares', 'spiral matrix']
};

// Error type patterns
const ERROR_PATTERNS = {
  'Wrong Answer': { type: 'logic', description: 'Logic or algorithm implementation issues' },
  'Time Limit Exceeded': { type: 'efficiency', description: 'Solution too slow, needs optimization' },
  'Runtime Error': { type: 'runtime', description: 'Edge cases, null pointers, or index issues' },
  'Memory Limit Exceeded': { type: 'memory', description: 'Excessive memory usage' },
  'Compile Error': { type: 'syntax', description: 'Syntax or compilation issues' }
};

// Normalize status to standard format
function normalizeStatus(status) {
  if (!status) return 'Other';
  const s = status.toLowerCase();
  if (s.includes('accepted')) return 'Accepted';
  if (s.includes('wrong')) return 'Wrong Answer';
  if (s.includes('time limit') || s.includes('tle')) return 'Time Limit Exceeded';
  if (s.includes('runtime')) return 'Runtime Error';
  if (s.includes('memory')) return 'Memory Limit Exceeded';
  if (s.includes('compile')) return 'Compile Error';
  return 'Other';
}

/**
 * Classify a problem into a topic based on title
 */
function classifyProblem(title) {
  const lowerTitle = title.toLowerCase();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerTitle.includes(keyword)) {
        return topic;
      }
    }
  }
  return 'General Problem Solving';
}

/**
 * Main diagnosis function - Enhanced with deep analysis
 */
function diagnose(input) {
  const { submissions } = input;

  if (!submissions || submissions.length === 0) {
    return {
      weak_topics: [],
      error_patterns: [],
      confidence_gaps: [],
      struggling_problems: [],
      confidence_level: 'unknown',
      confidence_scores: {},
      evidence: [],
      timestamp: new Date().toISOString(),
      status: 'no_data'
    };
  }

  // Analyze submissions by topic
  const topicStats = {};
  const problemStats = {};
  const errorStats = {};
  const timelineData = [];

  submissions.forEach((sub, index) => {
    const topic = classifyProblem(sub.title);
    const rawStatus = sub.statusDisplay || sub.status;
    const normalizedStatus = normalizeStatus(rawStatus);
    const isAccepted = normalizedStatus === 'Accepted';
    const timestamp = sub.timestamp || index; // Use index if no timestamp

    // Track timeline
    timelineData.push({
      index,
      topic,
      status: normalizedStatus,
      title: sub.title,
      isAccepted
    });

    // Initialize topic stats
    if (!topicStats[topic]) {
      topicStats[topic] = {
        total: 0,
        accepted: 0,
        failed: 0,
        problems: new Set(),
        failedProblems: [],
        errorTypes: {},
        recentTrend: [] // Track last 5 submissions in topic
      };
    }

    topicStats[topic].total++;
    topicStats[topic].recentTrend.push(isAccepted);
    if (topicStats[topic].recentTrend.length > 5) {
      topicStats[topic].recentTrend.shift();
    }

    if (isAccepted) {
      topicStats[topic].accepted++;
    } else {
      topicStats[topic].failed++;
      topicStats[topic].failedProblems.push(sub.title);
      
      // Track error types per topic
      if (!topicStats[topic].errorTypes[normalizedStatus]) {
        topicStats[topic].errorTypes[normalizedStatus] = 0;
      }
      topicStats[topic].errorTypes[normalizedStatus]++;
    }
    topicStats[topic].problems.add(sub.title);

    // Track global error stats
    if (!isAccepted) {
      if (!errorStats[normalizedStatus]) {
        errorStats[normalizedStatus] = { count: 0, problems: [], topics: new Set() };
      }
      errorStats[normalizedStatus].count++;
      errorStats[normalizedStatus].problems.push(sub.title);
      errorStats[normalizedStatus].topics.add(topic);
    }

    // Track per-problem stats
    if (!problemStats[sub.title]) {
      problemStats[sub.title] = { 
        attempts: 0, 
        accepted: false, 
        topic,
        errorTypes: {},
        firstAttemptIndex: index,
        lastAttemptIndex: index
      };
    }
    problemStats[sub.title].attempts++;
    problemStats[sub.title].lastAttemptIndex = index;
    if (isAccepted) {
      problemStats[sub.title].accepted = true;
    } else {
      if (!problemStats[sub.title].errorTypes[normalizedStatus]) {
        problemStats[sub.title].errorTypes[normalizedStatus] = 0;
      }
      problemStats[sub.title].errorTypes[normalizedStatus]++;
    }
  });

  // Calculate confidence scores and weak topics
  const confidence_scores = {};
  const weak_topics = [];
  const evidence = [];

  for (const [topic, stats] of Object.entries(topicStats)) {
    const successRate = stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0;
    const score = Math.round(successRate);
    confidence_scores[topic] = score;

    const uniqueProblems = stats.problems.size;
    const avgAttempts = stats.total / uniqueProblems;

    // Calculate trend for this topic
    const recentSuccess = stats.recentTrend.filter(x => x).length;
    const recentTotal = stats.recentTrend.length;
    const recentRate = recentTotal > 0 ? (recentSuccess / recentTotal) * 100 : 0;
    const trendDirection = recentRate > score ? 'improving' : recentRate < score ? 'declining' : 'stable';

    // Determine most common error type for this topic
    const dominantError = Object.entries(stats.errorTypes)
      .sort((a, b) => b[1] - a[1])[0];

    // If success rate is below 70%, mark as weak
    if (score < 70) {
      const topicEvidence = [];
      topicEvidence.push(`Success rate: ${score}% (${stats.accepted}/${stats.total} submissions)`);

      if (stats.failedProblems.length > 0) {
        const uniqueFailed = [...new Set(stats.failedProblems)].slice(0, 3);
        topicEvidence.push(`Failed problems: ${uniqueFailed.join(', ')}`);
      }

      if (avgAttempts > 2) {
        topicEvidence.push(`Average ${avgAttempts.toFixed(1)} attempts per problem`);
      }

      if (dominantError) {
        topicEvidence.push(`Most common error: ${dominantError[0]} (${dominantError[1]} times)`);
      }

      // Generate personalized strategy based on error type
      let strategy = generateTopicStrategy(topic, score, dominantError, trendDirection);

      weak_topics.push({
        topic,
        score,
        confidence: score, // Alias for UI compatibility
        severity: score < 40 ? 'critical' : score < 60 ? 'high' : 'medium',
        evidence: topicEvidence,
        problem_count: uniqueProblems,
        failed_count: stats.failed,
        dominant_error: dominantError ? dominantError[0] : null,
        trend: trendDirection,
        strategy
      });

      evidence.push(...topicEvidence.map(e => `[${topic}] ${e}`));
    }
  }

  // Sort weak topics by score (lowest first)
  weak_topics.sort((a, b) => a.score - b.score);

  // Analyze error patterns globally
  const error_patterns = analyzeErrorPatterns(errorStats, submissions.length);

  // Identify struggling problems (3+ attempts, not solved)
  const struggling_problems = Object.entries(problemStats)
    .filter(([_, stats]) => !stats.accepted && stats.attempts >= 3)
    .map(([title, stats]) => ({
      title,
      attempts: stats.attempts,
      topic: stats.topic,
      dominant_error: Object.entries(stats.errorTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown',
      suggestion: generateProblemSuggestion(stats)
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);

  // Identify confidence gaps (topics with inconsistent performance)
  const confidence_gaps = identifyConfidenceGaps(topicStats, problemStats);

  // Calculate overall confidence level
  const overallSuccessRate = Math.round(
    (submissions.filter(s => normalizeStatus(s.statusDisplay || s.status) === 'Accepted').length / submissions.length) * 100
  );
  const confidence_level = calculateConfidenceLevel(overallSuccessRate, weak_topics.length, error_patterns);

  // Find behavioral patterns
  const patterns = detectPatterns(submissions, problemStats);

  // Calculate learning velocity
  const learning_velocity = calculateLearningVelocity(timelineData);

  return {
    weak_topics,
    error_patterns,
    confidence_gaps,
    struggling_problems,
    confidence_level,
    confidence_scores,
    evidence,
    patterns,
    learning_velocity,
    total_submissions: submissions.length,
    total_problems: Object.keys(problemStats).length,
    overall_success_rate: overallSuccessRate,
    timestamp: new Date().toISOString(),
    status: 'analyzed'
  };
}

/**
 * Generate personalized strategy for a weak topic
 */
function generateTopicStrategy(topic, score, dominantError, trend) {
  const strategies = {
    'Dynamic Programming': {
      low: 'Start with simple 1D DP problems like Fibonacci, Climbing Stairs. Focus on identifying subproblems.',
      medium: 'Practice recognizing DP patterns: linear, grid-based, interval. Work on state transition.',
      improving: 'Good progress! Try medium-level problems and focus on optimizing space complexity.'
    },
    'Arrays & Hashing': {
      low: 'Review hash map basics. Practice Two Sum variations to understand key-value lookups.',
      medium: 'Focus on sliding window + hashmap combinations. Practice frequency counting problems.',
      improving: 'Challenge yourself with multi-pass and in-place modification problems.'
    },
    'Binary Search': {
      low: 'Master the basic template first. Practice simple problems like Search Insert Position.',
      medium: 'Learn search space variations. Practice problems where you binary search the answer.',
      improving: 'Try rotated array variants and problems with non-obvious search conditions.'
    },
    'Trees': {
      low: 'Start with traversals (inorder, preorder, postorder). Understand recursion on trees.',
      medium: 'Practice tree property problems: height, balance, BST validation.',
      improving: 'Move to path problems and tree construction from traversals.'
    },
    'Graphs': {
      low: 'Learn BFS/DFS templates thoroughly. Practice island counting type problems.',
      medium: 'Work on detecting cycles, topological sort, and multi-source BFS.',
      improving: 'Try shortest path algorithms and graph connectivity problems.'
    }
  };

  const topicStrategies = strategies[topic] || {
    low: `Focus on fundamental ${topic} concepts. Practice basic patterns repeatedly.`,
    medium: `Build on basics with medium difficulty ${topic} problems.`,
    improving: `Good progress in ${topic}! Challenge yourself with harder variants.`
  };

  if (trend === 'improving') {
    return topicStrategies.improving;
  } else if (score < 40) {
    return topicStrategies.low;
  } else {
    return topicStrategies.medium;
  }
}

/**
 * Analyze error patterns globally
 */
function analyzeErrorPatterns(errorStats, totalSubmissions) {
  const patterns = [];

  for (const [errorType, data] of Object.entries(errorStats)) {
    const errorInfo = ERROR_PATTERNS[errorType] || { type: 'other', description: 'Other errors' };
    const percentage = Math.round((data.count / totalSubmissions) * 100);
    
    if (percentage >= 5) { // Only report if at least 5% of submissions
      const uniqueProblems = [...new Set(data.problems)].slice(0, 3);
      const topics = [...data.topics];

      patterns.push({
        error_type: errorType,
        category: errorInfo.type,
        count: data.count,
        percentage,
        description: errorInfo.description,
        affected_problems: uniqueProblems,
        affected_topics: topics,
        recommendation: generateErrorRecommendation(errorType, topics)
      });
    }
  }

  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Generate recommendation based on error type
 */
function generateErrorRecommendation(errorType, topics) {
  const recommendations = {
    'Wrong Answer': `Focus on edge cases and boundary conditions. Trace through your solution with example inputs before submitting.`,
    'Time Limit Exceeded': `Your solution is correct but slow. Look for O(n²) loops that could be O(n log n) or O(n). Consider hash maps instead of nested loops.`,
    'Runtime Error': `Check for null/undefined access, array bounds, and division by zero. Add input validation.`,
    'Memory Limit Exceeded': `Optimize space usage. Consider iterative vs recursive, or use rolling arrays for DP.`,
    'Compile Error': `Review syntax carefully. Use an IDE with linting before submitting.`
  };

  return recommendations[errorType] || 'Review your approach and test with edge cases.';
}

/**
 * Identify confidence gaps - topics where performance is inconsistent
 */
function identifyConfidenceGaps(topicStats, problemStats) {
  const gaps = [];

  for (const [topic, stats] of Object.entries(topicStats)) {
    if (stats.problems.size < 2) continue;

    // Check for inconsistency: some problems solved easily, others with many attempts
    const problemsInTopic = Object.entries(problemStats)
      .filter(([_, s]) => s.topic === topic);

    const attempts = problemsInTopic.map(([_, s]) => s.attempts);
    const maxAttempts = Math.max(...attempts);
    const minAttempts = Math.min(...attempts);
    const variance = maxAttempts - minAttempts;

    // Check for mixed success
    const solved = problemsInTopic.filter(([_, s]) => s.accepted).length;
    const unsolved = problemsInTopic.filter(([_, s]) => !s.accepted).length;

    if (variance > 3 || (solved > 0 && unsolved > 0)) {
      gaps.push({
        topic,
        solved_count: solved,
        unsolved_count: unsolved,
        attempt_variance: variance,
        description: solved > 0 && unsolved > 0
          ? `Inconsistent in ${topic}: solved ${solved} but struggling with ${unsolved} problems`
          : `High variance in attempts for ${topic} problems`,
        recommendation: `Review ${topic} concepts systematically. Some gaps in understanding may exist.`
      });
    }
  }

  return gaps;
}

/**
 * Generate suggestion for a struggling problem
 */
function generateProblemSuggestion(stats) {
  if (stats.errorTypes['Time Limit Exceeded']) {
    return 'Consider more efficient data structures or algorithms. Your approach might be too slow.';
  }
  if (stats.errorTypes['Wrong Answer']) {
    return 'Review edge cases and test with small inputs. Debug your logic step by step.';
  }
  if (stats.errorTypes['Runtime Error']) {
    return 'Check for null values, array bounds, and special inputs.';
  }
  return 'Take a break and revisit with fresh perspective. Consider looking at similar problems for patterns.';
}

/**
 * Calculate overall confidence level
 */
function calculateConfidenceLevel(successRate, weakTopicsCount, errorPatterns) {
  const highErrorRate = errorPatterns.some(p => p.percentage > 30);
  
  if (successRate >= 80 && weakTopicsCount === 0) {
    return 'high';
  } else if (successRate >= 60 && weakTopicsCount <= 2 && !highErrorRate) {
    return 'medium';
  } else if (successRate >= 40) {
    return 'low';
  } else {
    return 'very_low';
  }
}

/**
 * Calculate learning velocity (are they improving over time?)
 */
function calculateLearningVelocity(timelineData) {
  if (timelineData.length < 10) {
    return { direction: 'insufficient_data', description: 'Need more submissions to determine trend' };
  }

  const half = Math.floor(timelineData.length / 2);
  const firstHalf = timelineData.slice(0, half);
  const secondHalf = timelineData.slice(half);

  const firstSuccessRate = firstHalf.filter(x => x.isAccepted).length / firstHalf.length;
  const secondSuccessRate = secondHalf.filter(x => x.isAccepted).length / secondHalf.length;

  const diff = secondSuccessRate - firstSuccessRate;

  if (diff > 0.15) {
    return { 
      direction: 'accelerating', 
      change: Math.round(diff * 100),
      description: 'Significant improvement! Performance is getting better over time.'
    };
  } else if (diff > 0.05) {
    return { 
      direction: 'improving', 
      change: Math.round(diff * 100),
      description: 'Steady improvement in recent submissions.'
    };
  } else if (diff < -0.15) {
    return { 
      direction: 'declining', 
      change: Math.round(diff * 100),
      description: 'Performance declining. Consider reviewing fundamentals.'
    };
  } else if (diff < -0.05) {
    return { 
      direction: 'slowing', 
      change: Math.round(diff * 100),
      description: 'Slight decline in recent performance.'
    };
  } else {
    return { 
      direction: 'stable', 
      change: Math.round(diff * 100),
      description: 'Consistent performance level maintained.'
    };
  }
}

/**
 * Detect behavioral patterns in submissions
 */
function detectPatterns(submissions, problemStats) {
  const patterns = [];

  // Pattern: Giving up too early
  const abandonedProblems = Object.entries(problemStats)
    .filter(([_, stats]) => !stats.accepted && stats.attempts < 3)
    .map(([name]) => name);

  if (abandonedProblems.length > 0) {
    patterns.push({
      type: 'early_abandonment',
      description: 'Tends to give up after few attempts',
      affected_problems: abandonedProblems.slice(0, 3),
      recommendation: 'Try at least 3-4 approaches before moving on'
    });
  }

  // Pattern: Multiple failures before success
  const hardWonProblems = Object.entries(problemStats)
    .filter(([_, stats]) => stats.accepted && stats.attempts > 4)
    .map(([name, stats]) => ({ name, attempts: stats.attempts }));

  if (hardWonProblems.length > 0) {
    patterns.push({
      type: 'persistence',
      description: 'Shows persistence on difficult problems',
      affected_problems: hardWonProblems.slice(0, 3),
      recommendation: 'Good trait! Consider reviewing optimal solutions after solving'
    });
  }

  // Pattern: Language consistency
  const languages = new Set(submissions.map(s => s.lang));
  if (languages.size > 2) {
    patterns.push({
      type: 'language_switching',
      description: 'Frequently switches between programming languages',
      languages: [...languages],
      recommendation: 'Consider mastering one language for interviews'
    });
  }

  return patterns;
}

export { diagnose, classifyProblem, normalizeStatus, TOPIC_KEYWORDS, ERROR_PATTERNS };
