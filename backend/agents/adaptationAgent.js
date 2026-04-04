/**
 * Adaptation Agent (Enhanced)
 * Dynamically adjusts learning strategy based on monitoring results and patterns
 *
 * Features:
 * - Personalized strategy adjustments based on specific struggles
 * - Topic-specific recommendations with concrete actions
 * - Learning style adaptation
 * - Dynamic difficulty adjustment
 * - Progress-based milestone recalibration
 *
 * Input: { monitoring_result, current_plan, goals, diagnosis }
 * Output: { action, reason, adjustments, recommendations, next_steps }
 */

// Adaptation rules configuration
const ADAPTATION_RULES = {
  // Success rate based rules
  SUCCESS_HIGH: {
    threshold: 80,
    action: 'increase_difficulty',
    reason: 'Excellent performance - ready for harder challenges'
  },
  SUCCESS_GOOD: {
    threshold: 65,
    action: 'maintain_pace',
    reason: 'Good progress - continue with current strategy'
  },
  SUCCESS_MODERATE: {
    threshold: 50,
    action: 'add_practice',
    reason: 'Moderate performance - add more practice problems'
  },
  SUCCESS_LOW: {
    threshold: 35,
    action: 'simplify_problems',
    reason: 'Struggling with current difficulty - step back to basics'
  },
  SUCCESS_CRITICAL: {
    threshold: 0,
    action: 'reset_foundation',
    reason: 'Critical struggles - need to rebuild from fundamentals'
  },

  // Trend based rules
  TREND_DECLINING_FAST: {
    condition: (delta) => delta < -15,
    action: 'pause_and_review',
    reason: 'Sharp decline detected - time to consolidate learning'
  },
  TREND_STAGNANT: {
    condition: (attempts, delta) => attempts > 10 && Math.abs(delta) < 5,
    action: 'change_strategy',
    reason: 'Plateau detected - need different approach'
  },

  // Activity based rules
  LOW_ACTIVITY: {
    condition: (attempts) => attempts < 3,
    action: 'encourage_activity',
    reason: 'Low activity - need more consistent practice'
  }
};

// Strategy modifications
const STRATEGY_MODIFICATIONS = {
  increase_difficulty: {
    difficulty_adjustment: +1,
    problems_per_day_adjustment: 0,
    focus_shift: 'advance to harder problems',
    message: 'Leveling up! Prepare for more challenging problems.',
    emoji: '🚀'
  },
  maintain_pace: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'continue current approach',
    message: 'Keep up the good work! Stay consistent.',
    emoji: '✅'
  },
  add_practice: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: +1,
    focus_shift: 'more repetition at current level',
    message: 'Adding extra practice to strengthen understanding.',
    emoji: '📚'
  },
  simplify_problems: {
    difficulty_adjustment: -1,
    problems_per_day_adjustment: 0,
    focus_shift: 'step back to easier problems',
    message: 'Let\'s build a stronger foundation first.',
    emoji: '🔄'
  },
  reset_foundation: {
    difficulty_adjustment: -2,
    problems_per_day_adjustment: -1,
    focus_shift: 'return to basics',
    message: 'Starting fresh with fundamentals to build solid understanding.',
    emoji: '🏗️'
  },
  pause_and_review: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: -1,
    focus_shift: 'review completed problems',
    message: 'Taking time to review and consolidate what you\'ve learned.',
    emoji: '⏸️'
  },
  change_strategy: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'try different problem types',
    message: 'Trying a new approach to break through the plateau.',
    emoji: '🔀'
  },
  encourage_activity: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'increase practice frequency',
    message: 'Consistency is key! Try to practice daily.',
    emoji: '⏰'
  },
  extend_deadline: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'more time needed',
    message: 'Extending timeline to allow for steady progress.',
    emoji: '📅'
  },
  focus_weak_topic: {
    difficulty_adjustment: -1,
    problems_per_day_adjustment: 0,
    focus_shift: 'concentrate on weak areas',
    message: 'Focusing on your identified weak areas for targeted improvement.',
    emoji: '🎯'
  }
};

// Personalized message templates
const PERSONALIZED_MESSAGES = {
  'Dynamic Programming': {
    struggling: 'DP can be tricky! Focus on identifying the subproblem structure first.',
    improving: 'Great progress with DP! Try recognizing patterns across problems.',
    mastered: 'Excellent DP skills! Consider tackling multi-dimensional DP problems.'
  },
  'Arrays & Hashing': {
    struggling: 'Hash maps are powerful tools. Practice mapping problems to key-value lookups.',
    improving: 'Good array skills developing! Try combining with two-pointer techniques.',
    mastered: 'Strong array fundamentals! Ready for complex in-place modifications.'
  },
  'Binary Search': {
    struggling: 'Binary search template is key. Master the basic form before variations.',
    improving: 'Getting better at BS! Try problems where you binary search the answer.',
    mastered: 'Excellent BS skills! Tackle rotated arrays and complex search spaces.'
  },
  'Trees': {
    struggling: 'Trees need recursive thinking. Practice simple traversals first.',
    improving: 'Tree skills improving! Work on path problems and BST properties.',
    mastered: 'Strong tree fundamentals! Try construction and serialization problems.'
  },
  'Graphs': {
    struggling: 'Graphs need solid BFS/DFS templates. Start with grid-based problems.',
    improving: 'Good graph progress! Add cycle detection and topological sort.',
    mastered: 'Advanced graph skills! Tackle shortest paths and complex connectivity.'
  }
};

/**
 * Determine action based on success rate
 */
function getActionFromSuccessRate(successRate) {
  if (successRate >= ADAPTATION_RULES.SUCCESS_HIGH.threshold) {
    return ADAPTATION_RULES.SUCCESS_HIGH;
  } else if (successRate >= ADAPTATION_RULES.SUCCESS_GOOD.threshold) {
    return ADAPTATION_RULES.SUCCESS_GOOD;
  } else if (successRate >= ADAPTATION_RULES.SUCCESS_MODERATE.threshold) {
    return ADAPTATION_RULES.SUCCESS_MODERATE;
  } else if (successRate >= ADAPTATION_RULES.SUCCESS_LOW.threshold) {
    return ADAPTATION_RULES.SUCCESS_LOW;
  } else {
    return ADAPTATION_RULES.SUCCESS_CRITICAL;
  }
}

/**
 * Check trend-based conditions
 */
function checkTrendConditions(trend, attempts) {
  if (trend.delta !== undefined) {
    if (ADAPTATION_RULES.TREND_DECLINING_FAST.condition(trend.delta)) {
      return ADAPTATION_RULES.TREND_DECLINING_FAST;
    }
    if (ADAPTATION_RULES.TREND_STAGNANT.condition(attempts, trend.delta)) {
      return ADAPTATION_RULES.TREND_STAGNANT;
    }
  }
  return null;
}

/**
 * Generate personalized recommendations based on action and user context
 */
function generateRecommendations(action, topicProgress, errorPatterns, diagnosis) {
  const recommendations = [];

  // Base recommendations by action
  switch (action) {
    case 'increase_difficulty':
      recommendations.push({
        type: 'challenge',
        text: 'Try problems from the next difficulty tier',
        priority: 'high',
        actionable: 'Move from medium to hard problems'
      });
      recommendations.push({
        type: 'timing',
        text: 'Set a timer to practice interview conditions',
        priority: 'medium',
        actionable: 'Practice solving medium problems in under 20 minutes'
      });
      break;

    case 'simplify_problems':
      recommendations.push({
        type: 'foundation',
        text: 'Review the core pattern for this topic',
        priority: 'high',
        actionable: 'Watch a tutorial video on the fundamental pattern'
      });
      recommendations.push({
        type: 'learning',
        text: 'Study editorial solutions before attempting similar problems',
        priority: 'high',
        actionable: 'Read and understand 3 solutions for similar problems'
      });
      break;

    case 'reset_foundation':
      recommendations.push({
        type: 'learning',
        text: 'Watch video explanations for this topic',
        priority: 'critical',
        actionable: 'Complete a structured course or playlist on the topic'
      });
      recommendations.push({
        type: 'practice',
        text: 'Start with the most basic problem variations',
        priority: 'critical',
        actionable: 'Complete all "Easy" problems before moving on'
      });
      recommendations.push({
        type: 'review',
        text: 'Write down the key pattern/template',
        priority: 'high',
        actionable: 'Create a personal cheat sheet with the template code'
      });
      break;

    case 'pause_and_review':
      recommendations.push({
        type: 'review',
        text: 'Re-solve problems you completed earlier',
        priority: 'high',
        actionable: 'Attempt solved problems again without looking at your previous solution'
      });
      recommendations.push({
        type: 'rest',
        text: 'Take a short break - sometimes stepping away helps',
        priority: 'medium',
        actionable: 'Take a 1-2 day break, then return fresh'
      });
      break;

    case 'change_strategy':
      recommendations.push({
        type: 'variety',
        text: 'Try problems from a different subtopic',
        priority: 'high',
        actionable: 'Switch to a related but different pattern within the topic'
      });
      recommendations.push({
        type: 'method',
        text: 'Try explaining your approach out loud before coding',
        priority: 'medium',
        actionable: 'Use the "rubber duck" method - explain to yourself first'
      });
      recommendations.push({
        type: 'collaboration',
        text: 'Consider discussing with peers or studying solutions',
        priority: 'medium',
        actionable: 'Join a study group or discussion forum'
      });
      break;

    case 'encourage_activity':
      recommendations.push({
        type: 'habit',
        text: 'Set a daily reminder for practice time',
        priority: 'high',
        actionable: 'Schedule a fixed 30-minute daily practice slot'
      });
      recommendations.push({
        type: 'goal',
        text: 'Start with just one problem per day',
        priority: 'medium',
        actionable: 'Commit to solving at least 1 problem daily for a week'
      });
      break;

    default:
      recommendations.push({
        type: 'general',
        text: 'Keep practicing consistently',
        priority: 'medium',
        actionable: 'Maintain your current practice schedule'
      });
  }

  // Add error-specific recommendations
  if (errorPatterns && errorPatterns.length > 0) {
    const topError = errorPatterns[0];
    if (topError.error_type === 'Wrong Answer') {
      recommendations.push({
        type: 'debugging',
        text: 'Focus on edge case testing',
        priority: 'high',
        actionable: 'Before submitting, test with: empty input, single element, large inputs, negative numbers',
        specific_to: 'Wrong Answer errors'
      });
    } else if (topError.error_type === 'Time Limit Exceeded') {
      recommendations.push({
        type: 'optimization',
        text: 'Analyze time complexity before coding',
        priority: 'high',
        actionable: 'Write down the expected time complexity. If it\'s O(n²), look for O(n log n) alternatives.',
        specific_to: 'TLE errors'
      });
    } else if (topError.error_type === 'Runtime Error') {
      recommendations.push({
        type: 'safety',
        text: 'Add defensive checks in your code',
        priority: 'high',
        actionable: 'Always check for null, empty arrays, and array bounds before accessing',
        specific_to: 'Runtime errors'
      });
    }
  }

  return recommendations;
}

/**
 * Generate personalized topic message
 */
function getPersonalizedTopicMessage(topic, successRate) {
  const messages = PERSONALIZED_MESSAGES[topic];
  if (!messages) {
    if (successRate < 40) return `Focus on ${topic} fundamentals with structured practice.`;
    if (successRate < 70) return `Building ${topic} skills - keep practicing consistently.`;
    return `Strong ${topic} foundation - ready for advanced challenges.`;
  }

  if (successRate < 40) return messages.struggling;
  if (successRate < 70) return messages.improving;
  return messages.mastered;
}

/**
 * Adapt for specific topic struggles with deep analysis
 */
function adaptForTopic(topic, topicProgress, goalProgress, diagnosis) {
  const adaptations = [];

  if (!topicProgress) return adaptations;

  const { success_rate, attempts, dominant_error } = topicProgress;

  // Topic-specific adaptation based on success rate
  if (success_rate < 40 && attempts >= 3) {
    const message = getPersonalizedTopicMessage(topic, success_rate);
    adaptations.push({
      topic,
      action: 'topic_reset',
      suggestion: message,
      severity: 'high',
      resources: getTopicResources(topic),
      specific_issues: dominant_error ? [`Most common error: ${dominant_error}`] : []
    });
  } else if (success_rate < 60 && attempts >= 5) {
    adaptations.push({
      topic,
      action: 'topic_focus',
      suggestion: `${topic} needs more attention - you're close to breaking through!`,
      severity: 'medium',
      resources: getTopicResources(topic)
    });
  }

  // Goal-based adaptation
  if (goalProgress && goalProgress.status === 'behind') {
    adaptations.push({
      topic,
      action: 'goal_adjustment',
      suggestion: goalProgress.recommendation || 'Consider adjusting your goal timeline',
      severity: goalProgress.progress_percent < 25 ? 'high' : 'medium',
      current_pace: goalProgress.progress_percent,
      needed_pace: 100 - goalProgress.progress_percent,
      options: [
        'Extend the deadline by 3-5 days',
        'Reduce the target score temporarily',
        'Increase daily practice time'
      ]
    });
  }

  return adaptations;
}

/**
 * Get learning resources for a topic (enhanced)
 */
function getTopicResources(topic) {
  const resources = {
    'Dynamic Programming': [
      { type: 'video', name: 'NeetCode DP Patterns', url: 'https://neetcode.io/courses/dsa-for-beginners/23', priority: 'high' },
      { type: 'article', name: 'DP Patterns Study Guide', url: 'https://leetcode.com/discuss/study-guide/458695', priority: 'high' },
      { type: 'practice', name: 'Start with: Climbing Stairs, Fibonacci, House Robber', priority: 'medium' }
    ],
    'Arrays & Hashing': [
      { type: 'article', name: 'Array Techniques Card', url: 'https://leetcode.com/explore/learn/card/array-and-string/', priority: 'high' },
      { type: 'practice', name: 'Start with: Two Sum, Contains Duplicate', priority: 'medium' }
    ],
    'Binary Search': [
      { type: 'article', name: 'Binary Search Template', url: 'https://leetcode.com/discuss/study-guide/786126', priority: 'high' },
      { type: 'practice', name: 'Start with: Binary Search, Search Insert Position', priority: 'medium' }
    ],
    'Trees': [
      { type: 'article', name: 'Tree Traversal Guide', url: 'https://leetcode.com/explore/learn/card/data-structure-tree/', priority: 'high' },
      { type: 'practice', name: 'Start with: Max Depth, Invert Tree, Same Tree', priority: 'medium' }
    ],
    'Graphs': [
      { type: 'article', name: 'Graph Algorithms Guide', url: 'https://leetcode.com/explore/learn/card/graph/', priority: 'high' },
      { type: 'video', name: 'BFS/DFS Visualization', url: 'https://visualgo.net/en/dfsbfs', priority: 'medium' },
      { type: 'practice', name: 'Start with: Number of Islands, Flood Fill', priority: 'medium' }
    ],
    'Sliding Window': [
      { type: 'article', name: 'Sliding Window Patterns', url: 'https://leetcode.com/discuss/study-guide/657507', priority: 'high' },
      { type: 'practice', name: 'Start with: Best Time to Buy Stock, Max Subarray', priority: 'medium' }
    ],
    'Two Pointers': [
      { type: 'article', name: 'Two Pointer Techniques', url: 'https://leetcode.com/articles/two-pointer-technique/', priority: 'high' },
      { type: 'practice', name: 'Start with: Valid Palindrome, Two Sum II', priority: 'medium' }
    ]
  };

  return resources[topic] || [
    { type: 'general', name: 'LeetCode Explore', url: 'https://leetcode.com/explore/', priority: 'medium' },
    { type: 'general', name: 'NeetCode Roadmap', url: 'https://neetcode.io/roadmap', priority: 'medium' }
  ];
}

/**
 * Generate next steps based on adaptation
 */
function generateNextSteps(action, topicAdaptations, goalAdjustments) {
  const steps = [];

  // Primary action step
  const strategy = STRATEGY_MODIFICATIONS[action];
  if (strategy) {
    steps.push({
      order: 1,
      action: strategy.focus_shift,
      description: strategy.message,
      priority: 'high'
    });
  }

  // Topic-specific steps
  if (topicAdaptations.length > 0) {
    const topicStep = topicAdaptations[0];
    steps.push({
      order: 2,
      action: `Focus on ${topicStep.topic}`,
      description: topicStep.suggestion,
      priority: topicStep.severity || 'medium'
    });
  }

  // Goal adjustment steps
  if (goalAdjustments.length > 0) {
    steps.push({
      order: 3,
      action: 'Review your goals',
      description: `Consider adjusting ${goalAdjustments.map(g => g.topic).join(', ')} goals`,
      priority: 'medium'
    });
  }

  return steps;
}

/**
 * Main adaptation function (Enhanced)
 */
function adapt(input) {
  const { monitoring_result, current_plan, goals, diagnosis } = input;

  if (!monitoring_result || monitoring_result.status === 'no_data') {
    return {
      action: 'encourage_activity',
      reason: 'No recent activity to analyze',
      strategy: STRATEGY_MODIFICATIONS.encourage_activity,
      recommendations: generateRecommendations('encourage_activity'),
      plan_changes: [],
      next_steps: [{
        order: 1,
        action: 'Start practicing',
        description: 'Complete at least one problem today to begin tracking your progress',
        priority: 'high'
      }],
      timestamp: new Date().toISOString(),
      status: 'waiting_for_data'
    };
  }

  const { progress, trend, goal_progress, by_topic, alerts, insights } = monitoring_result;
  const { success_rate, attempts } = progress;

  // Determine primary action
  let primaryAction;
  let reason;

  // Check activity level first
  if (ADAPTATION_RULES.LOW_ACTIVITY.condition(attempts)) {
    primaryAction = ADAPTATION_RULES.LOW_ACTIVITY;
  } else {
    // Check trend-based conditions
    const trendAction = checkTrendConditions(trend, attempts);
    if (trendAction) {
      primaryAction = trendAction;
    } else {
      // Fall back to success rate based action
      primaryAction = getActionFromSuccessRate(success_rate);
    }
  }

  const action = primaryAction.action;
  reason = primaryAction.reason;
  const strategy = STRATEGY_MODIFICATIONS[action];

  // Get error patterns from monitoring or diagnosis
  const errorPatterns = diagnosis?.error_patterns || [];

  // Generate recommendations
  const recommendations = generateRecommendations(action, by_topic, errorPatterns, diagnosis);

  // Topic-specific adaptations
  const topicAdaptations = [];
  if (goals && by_topic) {
    for (const goal of goals) {
      const topicProg = by_topic[goal.topic];
      const goalProg = goal_progress?.find(gp => gp.goal_id === goal.id);
      const adaptations = adaptForTopic(goal.topic, topicProg, goalProg, diagnosis);
      topicAdaptations.push(...adaptations);
    }
  }

  // Determine plan changes
  const planChanges = [];
  if (action === 'increase_difficulty' || action === 'simplify_problems') {
    planChanges.push({
      type: 'difficulty_adjustment',
      adjustment: strategy.difficulty_adjustment,
      description: strategy.focus_shift,
      impact: strategy.difficulty_adjustment > 0 ? 'Problems will be harder' : 'Problems will be easier'
    });
  }
  if (action === 'add_practice') {
    planChanges.push({
      type: 'volume_adjustment',
      adjustment: strategy.problems_per_day_adjustment,
      description: 'Adding more problems per day',
      impact: `+${strategy.problems_per_day_adjustment} problems per day`
    });
  }

  // Goal adjustments
  const goalAdjustments = (goal_progress || [])
    .filter(gp => gp.status === 'behind' || gp.status === 'regressing')
    .map(gp => ({
      goal_id: gp.goal_id,
      topic: gp.topic,
      suggested_action: 'extend_deadline',
      current_progress: gp.progress_percent,
      recommendation: gp.recommendation
    }));

  // Generate next steps
  const nextSteps = generateNextSteps(action, topicAdaptations, goalAdjustments);

  // Generate summary message
  const summaryMessage = generateAdaptationSummary(action, success_rate, topicAdaptations);

  return {
    action,
    reason,
    strategy,
    recommendations,
    plan_changes: planChanges,
    topic_adaptations: topicAdaptations,
    goal_adjustments: goalAdjustments,
    next_steps: nextSteps,
    summary: summaryMessage,
    confidence: calculateConfidence(progress, trend),
    next_check_after: calculateNextCheck(action),
    timestamp: new Date().toISOString(),
    status: 'adapted'
  };
}

/**
 * Generate adaptation summary
 */
function generateAdaptationSummary(action, successRate, topicAdaptations) {
  const strategy = STRATEGY_MODIFICATIONS[action];
  let summary = `${strategy.emoji} ${strategy.message}`;

  if (topicAdaptations.length > 0) {
    const topics = topicAdaptations.map(t => t.topic).join(', ');
    summary += ` Special attention needed for: ${topics}.`;
  }

  if (successRate >= 70) {
    summary += ' Keep up the excellent work!';
  } else if (successRate >= 50) {
    summary += ' You\'re making progress!';
  } else {
    summary += ' Focus on fundamentals and you\'ll improve!';
  }

  return summary;
}

/**
 * Calculate confidence in adaptation decision
 */
function calculateConfidence(progress, trend) {
  let confidence = 50; // Base confidence

  // More data = higher confidence
  if (progress.attempts >= 10) confidence += 20;
  else if (progress.attempts >= 5) confidence += 10;

  // Clear trend = higher confidence
  if (trend && trend.confidence === 'high') confidence += 15;
  else if (trend && trend.confidence === 'medium') confidence += 5;

  return Math.min(95, confidence);
}

/**
 * Calculate when to check again
 */
function calculateNextCheck(action) {
  const checkIntervals = {
    increase_difficulty: 5,
    maintain_pace: 7,
    add_practice: 3,
    simplify_problems: 4,
    reset_foundation: 5,
    pause_and_review: 2,
    change_strategy: 5,
    encourage_activity: 1,
    focus_weak_topic: 4
  };

  const interval = checkIntervals[action] || 5;

  return {
    after_submissions: interval,
    description: `Re-evaluate after ${interval} more submissions`,
    tip: interval <= 3 
      ? 'Quick check-in to see if the new approach is working'
      : 'Enough time to see meaningful progress'
  };
}

export { adapt, getActionFromSuccessRate, STRATEGY_MODIFICATIONS };
