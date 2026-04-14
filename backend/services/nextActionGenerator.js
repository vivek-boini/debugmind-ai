/**
 * Next Action Generator
 * Produces actionable next steps based on current state
 *
 * Features:
 * - Context-aware recommendations
 * - Priority-based actions
 * - Progress-sensitive suggestions
 */

/**
 * Generate next action based on current state
 */
function generateNextAction(state) {
  const {
    diagnosis,
    goals,
    current_plan,
    current_progress,
    current_adaptation,
    metrics
  } = state;

  // No data scenario
  if (!diagnosis || !diagnosis.weak_topics || diagnosis.weak_topics.length === 0) {
    if (!metrics || metrics.total_submissions === 0) {
      return {
        next_action: 'Extract your LeetCode submissions to get started',
        priority: 'high',
        category: 'setup',
        icon: '🚀',
        details: 'Use the Chrome extension to extract your submission data',
        estimated_time: '2 minutes'
      };
    }

    return {
      next_action: 'Great job! All topics are performing well. Continue practicing to maintain your skills.',
      priority: 'low',
      category: 'maintenance',
      icon: '✨',
      details: 'Consider exploring new topic areas',
      estimated_time: null
    };
  }

  // Priority calculation & Deterministic Sorting (Step 5)
  let weakestTopic = diagnosis?.weak_topics?.[0] || { topic: 'General Practice', score: 100 };
  
  if (goals && goals.length > 0) {
    const sortedGoals = [...goals].sort((a, b) => {
      // 1. Lowest success rate (current_score)
      if (a.current_score !== b.current_score) {
        return a.current_score - b.current_score;
      }
      // 2. Highest mistake frequency / severity (priority)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // 3. Lowest confidence (if explicit, otherwise string comparison for determinism)
      return (a.topic || '').localeCompare(b.topic || '');
    });
    weakestTopic = sortedGoals[0];
  }

  const successRate = current_progress?.progress?.success_rate || diagnosis?.overall_success_rate || 0;
  const trend = current_progress?.trend?.direction || 'stable';
  const adaptationAction = current_adaptation?.action || 'maintain_pace';

  let priority = 'medium';
  if (weakestTopic.current_score < 30 || weakestTopic.score < 30) priority = 'critical';
  else if (weakestTopic.current_score < 50 || weakestTopic.score < 50) priority = 'high';

  // Fix labels and clean description
  let formattedTopic = weakestTopic.topic || 'Concept Improvement';
  if (formattedTopic === 'AI-Identified Skill Gap') {
    const textPattern = (weakestTopic.strategy || weakestTopic.description || '').toLowerCase();
    if (textPattern.includes('two pointer')) formattedTopic = 'Two Pointer Optimization';
    else if (textPattern.includes('dp') || textPattern.includes('dynamic')) formattedTopic = 'Dynamic Programming Improvement';
    else if (textPattern.includes('edge case')) formattedTopic = 'Edge Case Handling';
    else formattedTopic = 'Concept Improvement';
  }
  formattedTopic = formattedTopic.replace(/AI-Identified/g, '').trim();

  let formattedDesc = weakestTopic.description || weakestTopic.strategy || '';
  if (formattedDesc.toLowerCase().includes('lack of clear problem understanding')) {
    formattedDesc = 'Improve understanding of problem patterns and solution approach';
  } else if (formattedDesc.toLowerCase().includes('no error handling') || formattedDesc.toLowerCase().includes('edge case')) {
    formattedDesc = 'Practice handling edge cases like n = 0 or empty inputs';
  }

  // Determine icon and reason (Step 8 & Follow-up)
  let icon = '🔥';
  let reason = 'Selected to build consistency and practice patterns.';
  
  if (priority === 'critical') {
    icon = '⚠️';
    reason = `Because success rate is critically low (${successRate}%) and frequent mistakes were detected.`;
  } else if (priority === 'high') {
    icon = '🔥';
    reason = `Because success rate is low (${successRate}%) and needs improvement.`;
  } else if (trend.includes('improving')) {
    icon = '📈';
    reason = 'Because you are improving, keep up the momentum.';
  }

  // Generate action based on adaptation state
  const actionGenerators = {
    simplify_problems: () => ({
      next_action: `Focus Area: ${formattedTopic}`,
      priority,
      category: 'foundation',
      icon,
      reason,
      details: formattedDesc || `Your success rate is ${successRate}%. Let's strengthen the basics before advancing.`,
      problems: getProblemSuggestions(current_plan, weakestTopic.topic, 'easy', 2),
      estimated_time: '45-60 minutes'
    }),

    increase_difficulty: () => ({
      next_action: `Focus Area: ${formattedTopic}`,
      priority: 'medium',
      category: 'challenge',
      icon,
      reason,
      details: formattedDesc || `Great progress! Success rate: ${successRate}%. Time to push further.`,
      problems: getProblemSuggestions(current_plan, weakestTopic.topic, 'medium', 1),
      estimated_time: '60-90 minutes'
    }),

    pause_and_review: () => ({
      next_action: `Focus Area: ${formattedTopic}`,
      priority: 'high',
      category: 'review',
      icon,
      reason,
      details: formattedDesc || 'Understanding why solutions work is key to retention.',
      estimated_time: '30 minutes'
    }),

    change_strategy: () => ({
      next_action: `Focus Area: ${formattedTopic}`,
      priority: 'high',
      category: 'learning',
      icon,
      reason,
      details: formattedDesc || 'Sometimes a fresh perspective helps break through plateaus.',
      resources: getTopicResources(weakestTopic.topic),
      estimated_time: '20-30 minutes'
    }),

    maintain_pace: () => ({
      next_action: `Focus Area: ${formattedTopic}`,
      priority: 'medium',
      category: 'practice',
      icon,
      reason,
      details: formattedDesc || `You're on track! Keep up the consistent practice.`,
      problems: getTodaysProblems(current_plan),
      estimated_time: '60 minutes'
    }),

    encourage_activity: () => ({
      next_action: `Focus Area: ${formattedTopic}`,
      priority: 'high',
      category: 'habit',
      icon,
      reason,
      details: formattedDesc || 'Consistency is more important than intensity.',
      problems: getProblemSuggestions(current_plan, weakestTopic.topic, 'easy', 1),
      estimated_time: '15-30 minutes'
    })
  };

  // Get appropriate action generator
  const generator = actionGenerators[adaptationAction] || actionGenerators.maintain_pace;
  const action = generator();

  // Add trend-based modifier
  if (trend === 'declining' || trend === 'declining_fast') {
    action.alert = {
      type: 'warning',
      message: 'Performance declining - consider taking a short break or reviewing fundamentals'
    };
  } else if (trend === 'improving_fast') {
    action.alert = {
      type: 'success',
      message: 'Excellent progress! You\'re improving rapidly'
    };
  }

  // Add goal context
  if (goals && goals.length > 0) {
    const primaryGoal = goals[0];
    action.goal_context = {
      topic: primaryGoal.topic,
      current: primaryGoal.current_score,
      target: primaryGoal.target_score,
      days_remaining: primaryGoal.deadline_days,
      progress_percent: Math.round((primaryGoal.current_score / primaryGoal.target_score) * 100)
    };
  }

  return action;
}

/**
 * Get problem suggestions from current plan
 */
function getProblemSuggestions(plan, topic, difficulty, count) {
  if (!plan || !plan.plan) return [];

  const topicProblems = plan.plan
    .filter(p => p.topic === topic && p.difficulty === difficulty)
    .flatMap(p => p.problems || [])
    .slice(0, count);

  if (topicProblems.length > 0) return topicProblems;

  // Fallback to any problems at difficulty level
  return plan.plan
    .filter(p => p.difficulty === difficulty)
    .flatMap(p => p.problems || [])
    .slice(0, count);
}

/**
 * Get today's focus from plan
 */
function getTodayFocus(plan) {
  if (!plan || !plan.plan) return 'Continue practicing';

  const currentDay = plan.current_day || 1;
  const todayPlan = plan.plan.find(p => p.day === currentDay);

  return todayPlan?.focus || 'Continue with your learning journey';
}

/**
 * Get today's problems from plan
 */
function getTodaysProblems(plan) {
  if (!plan || !plan.plan) return [];

  const currentDay = plan.current_day || 1;
  const todayPlan = plan.plan.filter(p => p.day === currentDay);

  return todayPlan.flatMap(p => p.problems || []);
}

/**
 * Get topic resources
 */
function getTopicResources(topic) {
  const resources = {
    'Dynamic Programming': [
      { type: 'video', title: 'Dynamic Programming Patterns', url: 'https://www.youtube.com/results?search_query=dynamic+programming+patterns' },
      { type: 'article', title: 'DP Patterns Guide', url: 'https://leetcode.com/discuss/study-guide/458695' }
    ],
    'Arrays & Hashing': [
      { type: 'article', title: 'Array Techniques', url: 'https://leetcode.com/explore/learn/card/array-and-string/' }
    ],
    'Trees': [
      { type: 'article', title: 'Tree Traversal Guide', url: 'https://leetcode.com/explore/learn/card/data-structure-tree/' }
    ],
    'Graphs': [
      { type: 'article', title: 'Graph Algorithms', url: 'https://leetcode.com/explore/learn/card/graph/' }
    ],
    'Binary Search': [
      { type: 'article', title: 'Binary Search Template', url: 'https://leetcode.com/explore/learn/card/binary-search/' }
    ]
  };

  return resources[topic] || [
    { type: 'general', title: 'LeetCode Explore', url: 'https://leetcode.com/explore/' }
  ];
}

/**
 * Generate smart alerts based on state
 */
function generateAlerts(state) {
  const alerts = [];
  const {
    diagnosis,
    current_progress,
    current_adaptation,
    metrics
  } = state;

  if (!diagnosis) return alerts;

  const successRate = current_progress?.progress?.success_rate || diagnosis.overall_success_rate || 0;
  const trend = current_progress?.trend?.direction || 'stable';
  const weakTopics = diagnosis.weak_topics || [];

  // Success rate alerts
  if (successRate >= 80) {
    alerts.push({
      type: 'success',
      icon: '🚀',
      title: 'Excellent Performance!',
      message: `${successRate}% success rate - you're crushing it!`,
      priority: 1
    });
  } else if (successRate < 40) {
    alerts.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Focus Needed',
      message: `${successRate}% success rate - consider reviewing fundamentals`,
      priority: 3
    });
  }

  // Trend alerts
  if (trend === 'improving' || trend === 'improving_fast') {
    alerts.push({
      type: 'success',
      icon: '📈',
      title: 'You\'re Improving!',
      message: 'Keep up the momentum - your hard work is paying off',
      priority: 2
    });
  } else if (trend === 'declining' || trend === 'declining_fast') {
    alerts.push({
      type: 'warning',
      icon: '📉',
      title: 'Stagnation Detected',
      message: 'Consider changing your approach or taking a short break',
      priority: 3
    });
  }

  // Adaptation alerts
  if (current_adaptation) {
    const adaptationAlerts = {
      increase_difficulty: {
        type: 'info',
        icon: '⬆️',
        title: 'Level Up!',
        message: 'Ready to tackle harder problems'
      },
      simplify_problems: {
        type: 'info',
        icon: '🔄',
        title: 'Strategy Adjusted',
        message: 'Focusing on fundamentals to build stronger foundation'
      },
      change_strategy: {
        type: 'info',
        icon: '💡',
        title: 'New Approach',
        message: 'Trying a different learning strategy'
      }
    };

    const adaptAlert = adaptationAlerts[current_adaptation.action];
    if (adaptAlert) {
      alerts.push({ ...adaptAlert, priority: 2 });
    }
  }

  // Critical topic alert
  const criticalTopics = weakTopics.filter(t => t.severity === 'critical');
  if (criticalTopics.length > 0) {
    alerts.push({
      type: 'error',
      icon: '🎯',
      title: 'Critical Focus Area',
      message: `${criticalTopics[0].topic} needs immediate attention (${criticalTopics[0].score}% confidence)`,
      priority: 4
    });
  }

  // Sort by priority (higher = more important)
  alerts.sort((a, b) => b.priority - a.priority);

  return alerts;
}

/**
 * Generate strategy evolution comparison
 */
function generateStrategyEvolution(adaptations) {
  if (!adaptations || adaptations.length < 2) {
    return null;
  }

  const current = adaptations[adaptations.length - 1];
  const previous = adaptations[adaptations.length - 2];

  if (current.action === previous.action) {
    return null; // No change
  }

  const strategyDescriptions = {
    increase_difficulty: 'Push with harder problems',
    simplify_problems: 'Focus on fundamentals',
    maintain_pace: 'Continue steady progress',
    pause_and_review: 'Review and consolidate',
    change_strategy: 'Try new approach',
    encourage_activity: 'Increase practice frequency'
  };

  return {
    before: {
      action: previous.action,
      description: strategyDescriptions[previous.action] || previous.action,
      timestamp: previous.applied_at || previous.timestamp,
      reason: previous.reason
    },
    after: {
      action: current.action,
      description: strategyDescriptions[current.action] || current.action,
      timestamp: current.applied_at || current.timestamp,
      reason: current.reason
    },
    change_reason: current.reason,
    confidence: current.confidence
  };
}

export {
  generateNextAction,
  generateAlerts,
  generateStrategyEvolution
};
