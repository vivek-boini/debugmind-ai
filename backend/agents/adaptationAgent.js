/**
 * Adaptation Agent
 * Adjusts learning strategy based on monitoring results
 *
 * Input: { monitoring_result, current_plan, goals }
 * Output: { action, reason, adjustments, new_recommendations }
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
    message: 'Leveling up! Prepare for more challenging problems.'
  },
  maintain_pace: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'continue current approach',
    message: 'Keep up the good work! Stay consistent.'
  },
  add_practice: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: +1,
    focus_shift: 'more repetition at current level',
    message: 'Adding extra practice to strengthen understanding.'
  },
  simplify_problems: {
    difficulty_adjustment: -1,
    problems_per_day_adjustment: 0,
    focus_shift: 'step back to easier problems',
    message: 'Let\'s build a stronger foundation first.'
  },
  reset_foundation: {
    difficulty_adjustment: -2,
    problems_per_day_adjustment: -1,
    focus_shift: 'return to basics',
    message: 'Starting fresh with fundamentals to build solid understanding.'
  },
  pause_and_review: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: -1,
    focus_shift: 'review completed problems',
    message: 'Taking time to review and consolidate what you\'ve learned.'
  },
  change_strategy: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'try different problem types',
    message: 'Trying a new approach to break through the plateau.'
  },
  encourage_activity: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'increase practice frequency',
    message: 'Consistency is key! Try to practice daily.'
  },
  extend_deadline: {
    difficulty_adjustment: 0,
    problems_per_day_adjustment: 0,
    focus_shift: 'more time needed',
    message: 'Extending timeline to allow for steady progress.'
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
 * Generate specific recommendations based on action
 */
function generateRecommendations(action, topicProgress) {
  const recommendations = [];

  switch (action) {
    case 'increase_difficulty':
      recommendations.push({
        type: 'challenge',
        text: 'Try problems from the next difficulty tier',
        priority: 'high'
      });
      recommendations.push({
        type: 'timing',
        text: 'Set a timer to practice interview conditions',
        priority: 'medium'
      });
      break;

    case 'simplify_problems':
      recommendations.push({
        type: 'foundation',
        text: 'Review the core pattern for this topic',
        priority: 'high'
      });
      recommendations.push({
        type: 'learning',
        text: 'Study editorial solutions before attempting similar problems',
        priority: 'high'
      });
      break;

    case 'reset_foundation':
      recommendations.push({
        type: 'learning',
        text: 'Watch video explanations for this topic',
        priority: 'critical'
      });
      recommendations.push({
        type: 'practice',
        text: 'Start with the most basic problem variations',
        priority: 'critical'
      });
      recommendations.push({
        type: 'review',
        text: 'Write down the key pattern/template',
        priority: 'high'
      });
      break;

    case 'pause_and_review':
      recommendations.push({
        type: 'review',
        text: 'Re-solve problems you completed earlier without looking at solutions',
        priority: 'high'
      });
      recommendations.push({
        type: 'rest',
        text: 'Take a short break - sometimes stepping away helps',
        priority: 'medium'
      });
      break;

    case 'change_strategy':
      recommendations.push({
        type: 'variety',
        text: 'Try problems from a different subtopic',
        priority: 'high'
      });
      recommendations.push({
        type: 'method',
        text: 'Try explaining your approach out loud before coding',
        priority: 'medium'
      });
      recommendations.push({
        type: 'collaboration',
        text: 'Consider pair programming or discussing with peers',
        priority: 'medium'
      });
      break;

    case 'encourage_activity':
      recommendations.push({
        type: 'habit',
        text: 'Set a daily reminder for practice time',
        priority: 'high'
      });
      recommendations.push({
        type: 'goal',
        text: 'Start with just one problem per day',
        priority: 'medium'
      });
      break;

    default:
      recommendations.push({
        type: 'general',
        text: 'Keep practicing consistently',
        priority: 'medium'
      });
  }

  return recommendations;
}

/**
 * Adapt for specific topic struggles
 */
function adaptForTopic(topic, topicProgress, goalProgress) {
  const adaptations = [];

  if (!topicProgress) return adaptations;

  const { success_rate, attempts } = topicProgress;

  if (success_rate < 40 && attempts >= 3) {
    adaptations.push({
      topic,
      action: 'topic_reset',
      suggestion: `Consider reviewing ${topic} fundamentals`,
      resources: getTopicResources(topic)
    });
  }

  if (goalProgress && goalProgress.status === 'behind') {
    adaptations.push({
      topic,
      action: 'goal_adjustment',
      suggestion: 'Consider extending deadline or adjusting target',
      current_pace: goalProgress.progress_percent,
      needed_pace: 100 - goalProgress.progress_percent
    });
  }

  return adaptations;
}

/**
 * Get learning resources for a topic
 */
function getTopicResources(topic) {
  const resources = {
    'Dynamic Programming': [
      { type: 'video', name: 'DP Patterns Video Course', url: 'https://neetcode.io' },
      { type: 'article', name: 'DP Patterns Guide', url: 'https://leetcode.com/discuss/study-guide/458695' }
    ],
    'Arrays & Hashing': [
      { type: 'article', name: 'Array Techniques', url: 'https://leetcode.com/explore/learn/card/array-and-string/' }
    ],
    'Trees': [
      { type: 'article', name: 'Tree Traversal Guide', url: 'https://leetcode.com/explore/learn/card/data-structure-tree/' }
    ],
    'Graphs': [
      { type: 'article', name: 'Graph Algorithms Guide', url: 'https://leetcode.com/explore/learn/card/graph/' }
    ]
  };

  return resources[topic] || [
    { type: 'general', name: 'LeetCode Explore', url: 'https://leetcode.com/explore/' }
  ];
}

/**
 * Main adaptation function
 */
function adapt(input) {
  const { monitoring_result, current_plan, goals } = input;

  if (!monitoring_result || monitoring_result.status === 'no_data') {
    return {
      action: 'encourage_activity',
      reason: 'No recent activity to analyze',
      strategy: STRATEGY_MODIFICATIONS.encourage_activity,
      recommendations: generateRecommendations('encourage_activity'),
      plan_changes: [],
      timestamp: new Date().toISOString(),
      status: 'waiting_for_data'
    };
  }

  const { progress, trend, goal_progress, by_topic } = monitoring_result;
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

  // Generate recommendations
  const recommendations = generateRecommendations(action, by_topic);

  // Topic-specific adaptations
  const topicAdaptations = [];
  if (goals && by_topic) {
    for (const goal of goals) {
      const topicProg = by_topic[goal.topic];
      const goalProg = goal_progress?.find(gp => gp.goal_id === goal.id);
      const adaptations = adaptForTopic(goal.topic, topicProg, goalProg);
      topicAdaptations.push(...adaptations);
    }
  }

  // Determine plan changes
  const planChanges = [];
  if (action === 'increase_difficulty' || action === 'simplify_problems') {
    planChanges.push({
      type: 'difficulty_adjustment',
      adjustment: strategy.difficulty_adjustment,
      description: strategy.focus_shift
    });
  }
  if (action === 'add_practice') {
    planChanges.push({
      type: 'volume_adjustment',
      adjustment: strategy.problems_per_day_adjustment,
      description: 'Adding more problems per day'
    });
  }

  // Goal adjustments
  const goalAdjustments = (goal_progress || [])
    .filter(gp => gp.status === 'behind')
    .map(gp => ({
      goal_id: gp.goal_id,
      topic: gp.topic,
      suggested_action: 'extend_deadline',
      current_progress: gp.progress_percent
    }));

  return {
    action,
    reason,
    strategy,
    recommendations,
    plan_changes: planChanges,
    topic_adaptations: topicAdaptations,
    goal_adjustments: goalAdjustments,
    confidence: calculateConfidence(progress, trend),
    next_check_after: calculateNextCheck(action),
    timestamp: new Date().toISOString(),
    status: 'adapted'
  };
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
    encourage_activity: 1
  };

  return {
    after_submissions: checkIntervals[action] || 5,
    description: `Re-evaluate after ${checkIntervals[action] || 5} more submissions`
  };
}

export { adapt, getActionFromSuccessRate, STRATEGY_MODIFICATIONS };
