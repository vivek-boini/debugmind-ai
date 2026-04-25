/**
 * Monitoring Agent (Enhanced)
 * Tracks user progress, detects patterns, and generates actionable insights
 *
 * Features:
 * - Deep trend analysis with multiple time windows
 * - Personalized alerts and suggestions
 * - Topic-specific progress tracking
 * - Learning velocity calculation
 * - Engagement metrics
 *
 * Input: { new_submissions, previous_progress, goals, classifyProblem }
 * Output: { progress, status, trends, alerts, insights, recommendations }
 */

// Status thresholds
const THRESHOLDS = {
  IMPROVING: { min_rate: 60, trend: 'up' },
  STABLE: { min_rate: 50, trend: 'stable' },
  STRUGGLING: { min_rate: 40, trend: 'down' },
  STAGNANT: { min_rate: 0, trend: 'flat' }
};

// Minimum submissions for reliable analysis
const MIN_SUBMISSIONS_FOR_TREND = 5;

// Status normalization
function normalizeStatus(status) {
  if (!status) return 'Other';
  const s = status.toLowerCase();
  if (s.includes('accepted') || s === 'ac') return 'Accepted';
  if (s.includes('wrong')) return 'Wrong Answer';
  if (s.includes('time limit') || s.includes('tle')) return 'Time Limit Exceeded';
  if (s.includes('runtime')) return 'Runtime Error';
  if (s.includes('memory')) return 'Memory Limit Exceeded';
  if (s.includes('compile')) return 'Compile Error';
  return 'Other';
}

// STEP 1: Robust accepted status check (handles all variants)
const isAccepted = (status) => {
  return ["Accepted", "accepted", "AC", "ac"].includes(status);
};

// STEP 2: Strong topic normalization
const normalizeTopic = (topic) => {
  if (!topic) return null;

  const t = topic.toLowerCase().replace(/[-_]/g, " ").trim();

  if (t.includes("sliding window")) return "Sliding Window";
  if (t.includes("dynamic programming") || t === "dp") return "Dynamic Programming";
  if (t.includes("array")) return "Arrays & Hashing";

  return topic;
};

// STEP 3: Infer topics from problem title (fallback when DB tags missing)
const inferTopicsFromTitle = (title) => {
  if (!title) return [];
  const t = title.toLowerCase();

  const topics = [];

  if (
    t.includes("substring") ||
    t.includes("subarray") ||
    t.includes("window")
  ) {
    topics.push("Sliding Window");
  }

  if (
    t.includes("dp") ||
    t.includes("path") ||
    t.includes("sequence") ||
    t.includes("climbing")
  ) {
    topics.push("Dynamic Programming");
  }

  return topics;
};

/**
 * Calculate success rate from submissions
 */
function calculateSuccessRate(submissions) {
  if (!submissions || submissions.length === 0) return 0;

  const accepted = submissions.filter(s => 
    normalizeStatus(s.statusDisplay || s.status) === 'Accepted'
  ).length;
  return Math.round((accepted / submissions.length) * 100);
}

/**
 * Detect trend by comparing periods
 */
function detectTrend(currentRate, previousRate, attempts) {
  if (attempts < MIN_SUBMISSIONS_FOR_TREND) {
    return {
      direction: 'insufficient_data',
      confidence: 'low',
      message: `Need ${MIN_SUBMISSIONS_FOR_TREND - attempts} more submissions for trend analysis`
    };
  }

  const delta = currentRate - previousRate;

  if (delta > 10) {
    return {
      direction: 'improving',
      confidence: 'high',
      delta,
      message: `Success rate improved by ${delta}%`,
      recommendation: 'Keep up the great work! Consider increasing problem difficulty.'
    };
  } else if (delta > 5) {
    return {
      direction: 'slightly_improving',
      confidence: 'medium',
      delta,
      message: `Slight improvement of ${delta}%`,
      recommendation: 'Good progress! Stay consistent with your practice.'
    };
  } else if (delta < -10) {
    return {
      direction: 'declining',
      confidence: 'high',
      delta,
      message: `Success rate dropped by ${Math.abs(delta)}%`,
      recommendation: 'Consider reviewing fundamentals or taking a break to avoid burnout.'
    };
  } else if (delta < -5) {
    return {
      direction: 'slightly_declining',
      confidence: 'medium',
      delta,
      message: `Slight decline of ${Math.abs(delta)}%`,
      recommendation: 'Focus on quality over quantity. Review mistakes before moving on.'
    };
  } else {
    return {
      direction: 'stable',
      confidence: 'medium',
      delta,
      message: 'Performance is stable',
      recommendation: 'Try challenging yourself with slightly harder problems.'
    };
  }
}

/**
 * Analyze progress by topic with deeper insights
 */
function analyzeTopicProgress(submissions, topic, classifier) {
  const topicSubmissions = submissions.filter(s => {
    const classified = classifier ? classifier(s.title) : 'General';
    return classified === topic;
  });

  if (topicSubmissions.length === 0) {
    return null;
  }

  const accepted = topicSubmissions.filter(s => 
    normalizeStatus(s.statusDisplay || s.status) === 'Accepted'
  ).length;
  const failed = topicSubmissions.length - accepted;

  // Analyze error types
  const errorBreakdown = {};
  topicSubmissions.forEach(s => {
    const status = normalizeStatus(s.statusDisplay || s.status);
    if (status !== 'Accepted') {
      errorBreakdown[status] = (errorBreakdown[status] || 0) + 1;
    }
  });

  // Find most common error
  const dominantError = Object.entries(errorBreakdown)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    topic,
    attempts: topicSubmissions.length,
    accepted,
    failed,
    success_rate: Math.round((accepted / topicSubmissions.length) * 100),
    problems_attempted: [...new Set(topicSubmissions.map(s => s.title))],
    error_breakdown: errorBreakdown,
    dominant_error: dominantError ? dominantError[0] : null,
    insight: generateTopicInsight(topic, accepted, failed, dominantError)
  };
}

/**
 * Generate insight for a topic
 */
function generateTopicInsight(topic, accepted, failed, dominantError) {
  const total = accepted + failed;
  const rate = Math.round((accepted / total) * 100);

  if (rate >= 80) {
    return `Strong performance in ${topic}! You're handling this topic well.`;
  } else if (rate >= 60) {
    if (dominantError) {
      return `Making progress in ${topic}, but watch out for ${dominantError[0]} errors (${dominantError[1]} occurrences).`;
    }
    return `Good progress in ${topic}. Continue practicing to reach mastery.`;
  } else if (rate >= 40) {
    if (dominantError) {
      return `${topic} needs attention. Focus on fixing ${dominantError[0]} issues which are your main challenge.`;
    }
    return `${topic} needs more focus. Consider reviewing the fundamentals.`;
  } else {
    return `Struggling with ${topic}. Start with easier problems and build up gradually.`;
  }
}

/**
 * Check goal progress with enhanced tracking
 */
function checkGoalProgress(goal, currentTopicProgress) {
  if (!currentTopicProgress) {
    return {
      goal_id: goal.id,
      topic: goal.topic,
      status: 'no_activity',
      message: 'No submissions for this topic yet',
      recommendation: `Start practicing ${goal.topic} problems to make progress on this goal.`
    };
  }

  const currentScore = currentTopicProgress.success_rate;
  const progressMade = currentScore - goal.current_score;
  const progressNeeded = goal.target_score - currentScore;
  const progressPercent = Math.round((progressMade / (goal.target_score - goal.current_score)) * 100);

  let status, message, recommendation;
  if (currentScore >= goal.target_score) {
    status = 'goal_achieved';
    message = `Congratulations! You've achieved your ${goal.topic} goal!`;
    recommendation = 'Consider setting a new challenge or moving to harder problems.';
  } else if (progressPercent >= 75) {
    status = 'almost_there';
    message = `Almost there! Just ${progressNeeded}% more to reach your ${goal.topic} goal.`;
    recommendation = 'Stay focused and keep practicing consistently.';
  } else if (progressPercent >= 50) {
    status = 'on_track';
    message = `Good progress on ${goal.topic}. You're halfway to your target.`;
    recommendation = 'Maintain your current pace to achieve the goal on time.';
  } else if (progressPercent >= 25) {
    status = 'needs_attention';
    message = `Progress is slower than expected for ${goal.topic}.`;
    recommendation = 'Increase daily practice time or focus on understanding patterns better.';
  } else if (progressPercent > 0) {
    status = 'behind';
    message = `Significantly behind on ${goal.topic} goal.`;
    recommendation = 'Consider adjusting your timeline or dedicating more focused practice sessions.';
  } else {
    status = 'regressing';
    message = `Performance in ${goal.topic} has declined.`;
    recommendation = 'Review fundamentals and consider stepping back to easier problems.';
  }

  return {
    goal_id: goal.id,
    topic: goal.topic,
    current_score: currentScore,
    target_score: goal.target_score,
    progress_made: progressMade,
    progress_needed: progressNeeded,
    progress_percent: Math.max(0, Math.min(100, progressPercent)),
    status,
    message,
    recommendation,
    days_remaining: goal.deadline_days,
    on_track: status === 'on_track' || status === 'almost_there' || status === 'goal_achieved'
  };
}

/**
 * Generate personalized alerts based on monitoring
 */
function generateAlerts(progress, trend, goalProgress, topicAnalysis) {
  const alerts = [];

  // Success rate alerts with personalized suggestions
  if (progress.success_rate < 30) {
    alerts.push({
      type: 'critical',
      category: 'performance',
      title: 'Low Success Rate',
      message: 'Success rate is critically low at ' + progress.success_rate + '%',
      suggestion: 'Focus on one topic at a time. Start with the easiest problems and master patterns before moving on.',
      action: 'reduce_difficulty'
    });
  } else if (progress.success_rate < 50) {
    alerts.push({
      type: 'warning',
      category: 'performance',
      title: 'Needs Improvement',
      message: 'Success rate of ' + progress.success_rate + '% needs work',
      suggestion: 'Spend more time understanding each problem before coding. Review your failed attempts.',
      action: 'review_patterns'
    });
  }

  // Trend alerts with context
  if (trend.direction === 'declining') {
    alerts.push({
      type: 'warning',
      category: 'trend',
      title: 'Performance Declining',
      message: trend.message,
      suggestion: trend.recommendation || 'Take a break or review fundamentals',
      action: 'take_break'
    });
  } else if (trend.direction === 'improving') {
    alerts.push({
      type: 'success',
      category: 'trend',
      title: 'Great Progress!',
      message: trend.message,
      suggestion: trend.recommendation || 'Keep up the great work!',
      action: 'increase_challenge'
    });
  }

  // Topic-specific alerts
  if (topicAnalysis) {
    Object.entries(topicAnalysis).forEach(([topic, data]) => {
      if (data.success_rate < 40 && data.attempts >= 3) {
        alerts.push({
          type: 'warning',
          category: 'topic',
          title: `Struggling with ${topic}`,
          message: `Only ${data.success_rate}% success rate in ${topic} after ${data.attempts} attempts`,
          suggestion: `Focus on ${topic} fundamentals before attempting more problems`,
          action: 'focus_topic',
          topic
        });
      }
    });
  }

  // Goal progress alerts
  if (goalProgress) {
    goalProgress.forEach(gp => {
      if (gp.status === 'behind' || gp.status === 'regressing') {
        alerts.push({
          type: 'warning',
          category: 'goal',
          title: `Behind on ${gp.topic}`,
          message: gp.message,
          suggestion: gp.recommendation,
          action: 'extend_deadline',
          topic: gp.topic
        });
      } else if (gp.status === 'goal_achieved') {
        alerts.push({
          type: 'success',
          category: 'goal',
          title: `Goal Achieved: ${gp.topic}!`,
          message: gp.message,
          suggestion: gp.recommendation,
          action: 'new_goal',
          topic: gp.topic
        });
      } else if (gp.status === 'almost_there') {
        alerts.push({
          type: 'info',
          category: 'goal',
          title: `Almost There: ${gp.topic}`,
          message: gp.message,
          suggestion: gp.recommendation,
          action: 'final_push',
          topic: gp.topic
        });
      }
    });
  }

  // Activity alerts
  if (progress.attempts < 3) {
    alerts.push({
      type: 'info',
      category: 'activity',
      title: 'Increase Practice',
      message: 'Only ' + progress.attempts + ' submission(s) recorded',
      suggestion: 'Try to solve at least 2-3 problems daily for consistent improvement',
      action: 'increase_activity'
    });
  }

  return alerts;
}

/**
 * Generate learning insights based on patterns
 */
function generateLearningInsights(submissions, progress, trend, topicAnalysis) {
  const insights = [];

  // Pattern detection
  const problemAttempts = {};
  submissions.forEach(s => {
    if (!problemAttempts[s.title]) {
      problemAttempts[s.title] = { attempts: 0, solved: false };
    }
    problemAttempts[s.title].attempts++;
    if (normalizeStatus(s.statusDisplay || s.status) === 'Accepted') {
      problemAttempts[s.title].solved = true;
    }
  });

  // Persistence insight
  const hardWonProblems = Object.entries(problemAttempts)
    .filter(([_, data]) => data.solved && data.attempts > 3);
  
  if (hardWonProblems.length > 0) {
    insights.push({
      type: 'positive',
      title: 'Persistence Pays Off',
      description: `You've solved ${hardWonProblems.length} problem(s) after multiple attempts. This shows great determination!`,
      examples: hardWonProblems.slice(0, 2).map(([name]) => name)
    });
  }

  // Giving up pattern
  const abandonedProblems = Object.entries(problemAttempts)
    .filter(([_, data]) => !data.solved && data.attempts < 3);
  
  if (abandonedProblems.length > 3) {
    insights.push({
      type: 'improvement',
      title: 'Try More Approaches',
      description: `You've given up on ${abandonedProblems.length} problems after only 1-2 attempts. Consider trying at least 3-4 different approaches before moving on.`,
      recommendation: 'Persistence builds problem-solving skills'
    });
  }

  // Topic variety
  const topicsAttempted = Object.keys(topicAnalysis || {}).length;
  if (topicsAttempted === 1) {
    insights.push({
      type: 'suggestion',
      title: 'Diversify Your Practice',
      description: 'You\'re focusing on just one topic. Try mixing different topics to build well-rounded skills.',
      recommendation: 'Variety helps reinforce connections between concepts'
    });
  } else if (topicsAttempted >= 5) {
    insights.push({
      type: 'positive',
      title: 'Well-Rounded Practice',
      description: `Great job practicing across ${topicsAttempted} different topics!`,
      recommendation: 'Consider deep-diving into your weakest topic next'
    });
  }

  // Learning velocity insight
  if (trend.direction === 'improving' && progress.success_rate >= 60) {
    insights.push({
      type: 'positive',
      title: 'Rapid Improvement',
      description: 'You\'re improving faster than average! Your learning approach is working well.',
      recommendation: 'Consider tackling more challenging problems'
    });
  }

  return insights;
}

/**
 * Calculate streaks and engagement
 */
function calculateStreaks(submissions) {
  if (!submissions || submissions.length === 0) {
    return { current: 0, longest: 0, days_active: 0, engagement_level: 'inactive' };
  }

  // Sort by timestamp
  const sorted = [...submissions].sort((a, b) =>
    new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
  );

  // Calculate unique active days
  const activeDays = new Set(
    sorted.map(s => {
      const date = new Date(s.timestamp * 1000);
      return date.toISOString().split('T')[0];
    })
  );

  // Calculate engagement level
  let engagementLevel;
  if (activeDays.size >= 7) {
    engagementLevel = 'highly_active';
  } else if (activeDays.size >= 4) {
    engagementLevel = 'active';
  } else if (activeDays.size >= 2) {
    engagementLevel = 'moderate';
  } else {
    engagementLevel = 'low';
  }

  return {
    current: activeDays.size > 0 ? 1 : 0,
    longest: activeDays.size,
    days_active: activeDays.size,
    engagement_level: engagementLevel,
    engagement_message: getEngagementMessage(engagementLevel)
  };
}

/**
 * Get engagement message
 */
function getEngagementMessage(level) {
  const messages = {
    highly_active: 'Excellent consistency! You\'re building strong habits.',
    active: 'Good activity level. Keep up the regular practice!',
    moderate: 'You\'re making progress. Try to practice more consistently.',
    low: 'Try to practice more regularly for better results.',
    inactive: 'Start practicing to build momentum!'
  };
  return messages[level] || 'Keep practicing!';
}

/**
 * Main monitoring function
 */
function monitor(input) {
  const { new_submissions, previous_progress, goals, classifyProblem } = input;

  if (!new_submissions || new_submissions.length === 0) {
    return {
      progress: {
        success_rate: 0,
        attempts: 0,
        accepted: 0,
        failed: 0
      },
      status: 'no_data',
      trend: null,
      goal_progress: [],
      alerts: [{
        type: 'info',
        category: 'activity',
        title: 'No Activity',
        message: 'No new submissions to analyze',
        suggestion: 'Start practicing to see your progress'
      }],
      insights: [],
      timestamp: new Date().toISOString()
    };
  }

  // Calculate current progress
  const accepted = new_submissions.filter(s => 
    normalizeStatus(s.statusDisplay || s.status) === 'Accepted'
  ).length;
  const failed = new_submissions.length - accepted;
  const successRate = calculateSuccessRate(new_submissions);

  const progress = {
    success_rate: successRate,
    attempts: new_submissions.length,
    accepted,
    failed,
    unique_problems: [...new Set(new_submissions.map(s => s.title))].length,
    acceptance_rate_display: `${accepted}/${new_submissions.length} (${successRate}%)`
  };

  // Analyze by topic
  const topicAnalysis = analyzeByTopic(new_submissions, classifyProblem);

  // Calculate trend
  const previousRate = previous_progress?.success_rate || 0;
  const trend = detectTrend(successRate, previousRate, new_submissions.length);

  // Determine overall status with context
  let status, statusMessage;
  if (successRate >= 70 && trend.direction.includes('improving')) {
    status = 'excelling';
    statusMessage = 'You\'re on fire! Excellent performance and improving trend.';
  } else if (successRate >= 60 || trend.direction.includes('improving')) {
    status = 'improving';
    statusMessage = 'Good progress! Keep building on this momentum.';
  } else if (successRate >= 40) {
    status = 'stable';
    statusMessage = 'Consistent performance. Look for areas to push harder.';
  } else if (trend.direction.includes('declining')) {
    status = 'struggling';
    statusMessage = 'Performance needs attention. Consider reviewing fundamentals.';
  } else {
    status = 'needs_focus';
    statusMessage = 'Time to refocus. Start with easier problems and build up.';
  }

  // Check goal progress
  const goalProgress = (goals || []).map(goal => {
    const topicProgress = analyzeTopicProgress(new_submissions, goal.topic, classifyProblem);
    return checkGoalProgress(goal, topicProgress);
  });

  // Calculate streaks
  const streaks = calculateStreaks(new_submissions);

  // Generate alerts
  const alerts = generateAlerts(progress, trend, goalProgress, topicAnalysis);

  // Generate insights
  const insights = generateLearningInsights(new_submissions, progress, trend, topicAnalysis);

  return {
    progress,
    status,
    status_message: statusMessage,
    status_emoji: getStatusEmoji(status),
    trend,
    goal_progress: goalProgress,
    streaks,
    alerts,
    insights,
    by_topic: topicAnalysis,
    summary: generateMonitoringSummary(progress, trend, goalProgress, streaks),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate monitoring summary
 */
function generateMonitoringSummary(progress, trend, goalProgress, streaks) {
  const goalsOnTrack = goalProgress.filter(g => g.on_track).length;
  const totalGoals = goalProgress.length;

  let summary = `Performance: ${progress.success_rate}% success rate (${progress.accepted}/${progress.attempts}). `;
  
  if (trend.direction === 'improving') {
    summary += 'Trend is positive! ';
  } else if (trend.direction === 'declining') {
    summary += 'Trend needs attention. ';
  }

  if (totalGoals > 0) {
    summary += `Goals: ${goalsOnTrack}/${totalGoals} on track. `;
  }

  if (streaks.engagement_level === 'highly_active') {
    summary += 'Great consistency!';
  }

  return summary;
}

/**
 * Get emoji for status
 */
function getStatusEmoji(status) {
  const emojis = {
    excelling: '🚀',
    improving: '📈',
    stable: '➡️',
    struggling: '📉',
    needs_focus: '⚠️',
    no_data: '❓'
  };
  return emojis[status] || '📊';
}

/**
 * UI-friendly topic display names
 */
const UI_TOPIC_MAP = {
  'sliding window': 'Sliding Window',
  'slidingwindow': 'Sliding Window',
  'sliding-window': 'Sliding Window',
  'dynamic programming': 'Dynamic Programming',
  'dp': 'Dynamic Programming',
  'dynamic-programming': 'Dynamic Programming',
  'binary search': 'Binary Search',
  'binarysearch': 'Binary Search',
  'binary-search': 'Binary Search',
  'two pointers': 'Two Pointers',
  'twopointers': 'Two Pointers',
  'two pointer': 'Two Pointers',
  'two-pointers': 'Two Pointers',
  'arrays & hashing': 'Arrays & Hashing',
  'arrays': 'Arrays & Hashing',
  'array': 'Arrays & Hashing',
  'hash table': 'Arrays & Hashing',
  'hash-table': 'Arrays & Hashing',
  'hashmap': 'Arrays & Hashing',
  'linked list': 'Linked List',
  'linkedlist': 'Linked List',
  'linked-list': 'Linked List',
  'trees': 'Trees',
  'tree': 'Trees',
  'binary tree': 'Trees',
  'binary-tree': 'Trees',
  'graphs': 'Graphs',
  'graph': 'Graphs',
  'stack & queue': 'Stack & Queue',
  'stack': 'Stack & Queue',
  'queue': 'Stack & Queue',
  'backtracking': 'Backtracking',
  'greedy': 'Greedy',
  'heap/priority queue': 'Heap/Priority Queue',
  'heap': 'Heap/Priority Queue',
  'priority queue': 'Heap/Priority Queue',
  'bit manipulation': 'Bit Manipulation',
  'bit-manipulation': 'Bit Manipulation',
  'math & geometry': 'Math & Geometry',
  'math': 'Math & Geometry',
  'general problem solving': 'General'
};

/**
 * Normalize a topic key to its UI display name
 */
function normalizeTopicDisplay(topic) {
  if (!topic) return 'General';
  const lower = topic.toLowerCase().trim().replace(/[_-]/g, ' ');
  const mapped = UI_TOPIC_MAP[lower] || UI_TOPIC_MAP[topic.toLowerCase().trim()] || topic;
  console.log('[Topic Mapping]', { raw: topic, normalized: lower, mapped });
  return mapped;
}

/**
 * Analyze submissions by topic with enhanced metrics
 * Uses DB tags + title inference + normalization for comprehensive, accurate coverage
 */
function analyzeByTopic(submissions, classifyProblem) {
  const byTopic = {};

  submissions.forEach(sub => {
    // STEP 4: Merge DB topics + inferred topics from title
    let topics = [
      ...(Array.isArray(sub.topics) ? sub.topics : []),
      ...(Array.isArray(sub.topicTags) ? sub.topicTags : [])
    ];

    if (!topics.length) {
      topics = inferTopicsFromTitle(sub.title);
    }

    // Merge both safely — normalize + deduplicate
    topics = [...new Set([
      ...topics.map(normalizeTopic),
      ...inferTopicsFromTitle(sub.title)
    ])].filter(Boolean);

    // Fallback to classifyProblem heuristic
    if (topics.length === 0 && classifyProblem) {
      const heuristic = classifyProblem(sub.title);
      if (heuristic) topics.push(heuristic);
    }

    if (topics.length === 0) {
      topics.push('General');
    }

    // STEP 6: Debug log per submission (MANDATORY)
    console.log("[Topic Debug]", {
      title: sub.title,
      topics,
      status: sub.status,
      accepted: isAccepted(sub.statusDisplay || sub.status)
    });

    topics.forEach(topic => {
      const key = normalizeTopicDisplay(topic);

      // STEP 5: ALWAYS ensure total exists
      if (!byTopic[key]) {
        byTopic[key] = {
          total: 0,
          attempts: 0,      // keep attempts for backwards compat
          accepted: 0,
          error_types: {},
          problems: new Set()
        };
      }

      byTopic[key].total += 1;
      byTopic[key].attempts += 1;
      byTopic[key].problems.add(sub.title);

      // STEP 1: Use isAccepted for robust status checking
      if (isAccepted(sub.statusDisplay || sub.status)) {
        byTopic[key].accepted += 1;
      } else {
        const status = normalizeStatus(sub.statusDisplay || sub.status);
        byTopic[key].error_types[status] = (byTopic[key].error_types[status] || 0) + 1;
      }
    });
  });

  // Calculate rates and insights
  Object.keys(byTopic).forEach(key => {
    const data = byTopic[key];

    // STEP 8: FINAL SAFETY FIX — accepted can never exceed total
    if (data.accepted > data.total) {
      data.accepted = data.total;
    }

    data.success_rate = data.total > 0
      ? Number(((data.accepted / data.total) * 100).toFixed(1))
      : 0;

    // The UI now reads successRate, so provide both for compatibility
    data.successRate = data.success_rate;

    data.unique_problems = data.problems.size;
    data.dominant_error = Object.entries(data.error_types)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    data.insight = generateTopicInsight(
      key,
      data.accepted,
      data.total - data.accepted,
      data.dominant_error ? [data.dominant_error, data.error_types[data.dominant_error]] : null
    );
    delete data.problems; // Remove Set before returning
  });

  console.log('[Topic Stats calculated]', Object.fromEntries(
    Object.entries(byTopic).map(([k, v]) => [k, {
      total: v.total, accepted: v.accepted, successRate: v.success_rate
    }])
  ));
  const dpStats = byTopic['Dynamic Programming'];
  const swStats = byTopic['Sliding Window'];
  if (dpStats) {
    console.log('[Topic Recompute] Dynamic Programming:', {
      before: 'n/a',
      after: {
        total: dpStats.total,
        accepted: dpStats.accepted,
        failed: Math.max(0, (dpStats.total || 0) - (dpStats.accepted || 0)),
        successRate: dpStats.success_rate
      }
    });
  }
  if (swStats) {
    console.log('[Topic Recompute] Sliding Window:', {
      before: 'n/a',
      after: {
        total: swStats.total,
        accepted: swStats.accepted,
        failed: Math.max(0, (swStats.total || 0) - (swStats.accepted || 0)),
        successRate: swStats.success_rate
      }
    });
  }

  return byTopic;
}

export { monitor, calculateSuccessRate, detectTrend, normalizeStatus };
