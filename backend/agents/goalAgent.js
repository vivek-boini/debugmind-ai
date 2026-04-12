/**
 * Goal Agent (Enhanced)
 * Sets personalized learning goals based on deep diagnosis results
 * 
 * Features:
 * - Contextual goal descriptions based on user's specific issues
 * - Dynamic goal text generation (not generic)
 * - Considers error patterns and confidence gaps
 * - Adapts goals to user's learning velocity
 *
 * Input: { weak_topics, confidence_scores, error_patterns, confidence_level, learning_velocity, total_submissions }
 * Output: { goals: [...], priority_order: [...], summary }
 */

// Default target improvements based on severity
const TARGET_IMPROVEMENTS = {
  critical: { target_delta: 45, deadline_days: 14 },
  high: { target_delta: 35, deadline_days: 10 },
  medium: { target_delta: 25, deadline_days: 7 }
};

// Minimum viable target score
const MIN_TARGET_SCORE = 75;
const MAX_TARGET_SCORE = 95;

// Goal templates for personalized descriptions
const GOAL_TEMPLATES = {
  'Dynamic Programming': {
    critical: [
      'Master DP fundamentals: Start with 1D problems before tackling 2D',
      'Build strong DP intuition through systematic pattern recognition',
      'Overcome DP struggles by breaking problems into smaller subproblems'
    ],
    high: [
      'Improve DP pattern recognition for faster problem solving',
      'Strengthen state transition understanding in DP problems'
    ],
    medium: [
      'Refine DP skills with optimization techniques',
      'Practice space optimization in DP solutions'
    ]
  },
  'Arrays & Hashing': {
    critical: [
      'Build foundational array manipulation skills',
      'Master hash map usage for O(1) lookups'
    ],
    high: [
      'Improve frequency counting and tracking patterns',
      'Strengthen two-pass array techniques'
    ],
    medium: [
      'Polish in-place array modification skills',
      'Practice complex hash map scenarios'
    ]
  },
  'Binary Search': {
    critical: [
      'Master the basic binary search template thoroughly',
      'Understand when and how to apply binary search'
    ],
    high: [
      'Improve binary search on answer space problems',
      'Strengthen rotated array handling'
    ],
    medium: [
      'Refine edge case handling in binary search',
      'Practice advanced binary search variants'
    ]
  },
  'Trees': {
    critical: [
      'Build strong tree traversal fundamentals',
      'Understand recursive thinking on tree structures'
    ],
    high: [
      'Improve tree property verification skills',
      'Strengthen path sum and depth calculations'
    ],
    medium: [
      'Polish tree construction techniques',
      'Practice ancestor/descendant problems'
    ]
  },
  'Graphs': {
    critical: [
      'Master BFS/DFS templates for graph traversal',
      'Build strong graph representation understanding'
    ],
    high: [
      'Improve cycle detection and connectivity skills',
      'Strengthen topological sort applications'
    ],
    medium: [
      'Refine shortest path algorithm skills',
      'Practice complex multi-source problems'
    ]
  }
};

// Error-based goal additions
const ERROR_GOAL_ADDITIONS = {
  'Wrong Answer': 'Focus on edge case analysis and logic verification',
  'Time Limit Exceeded': 'Prioritize algorithm efficiency and optimization',
  'Runtime Error': 'Strengthen null checking and boundary validation',
  'Memory Limit Exceeded': 'Learn space-efficient alternatives'
};

/**
 * Calculate appropriate target score
 */
function calculateTargetScore(currentScore, severity, learningVelocity) {
  const config = TARGET_IMPROVEMENTS[severity] || TARGET_IMPROVEMENTS.medium;
  let target = currentScore + config.target_delta;

  // Adjust based on learning velocity
  if (learningVelocity?.direction === 'accelerating') {
    target += 5; // More ambitious for improving learners
  } else if (learningVelocity?.direction === 'declining') {
    target -= 10; // More achievable for struggling learners
  }

  // Clamp between min and max
  target = Math.max(MIN_TARGET_SCORE, Math.min(MAX_TARGET_SCORE, target));

  return target;
}

/**
 * Calculate deadline based on gap and severity
 */
function calculateDeadline(currentScore, targetScore, severity, learningVelocity) {
  const gap = targetScore - currentScore;
  const baseConfig = TARGET_IMPROVEMENTS[severity] || TARGET_IMPROVEMENTS.medium;

  // Adjust deadline based on gap size
  let days = baseConfig.deadline_days;
  if (gap > 40) days += 5;
  if (gap > 50) days += 7;

  // Adjust based on learning velocity
  if (learningVelocity?.direction === 'declining' || learningVelocity?.direction === 'slowing') {
    days += 3; // Give more time if struggling
  } else if (learningVelocity?.direction === 'accelerating') {
    days = Math.max(5, days - 2); // Can be faster if improving well
  }

  return days;
}

/**
 * Generate personalized goal description
 */
function generateGoalDescription(topic, severity, weakTopic, errorPatterns, confidenceLevel) {
  // Get template-based description
  const templates = GOAL_TEMPLATES[topic] || {
    critical: [`Build strong ${topic} fundamentals from scratch`],
    high: [`Improve ${topic} problem-solving consistency`],
    medium: [`Refine ${topic} skills with advanced practice`]
  };

  const templateList = templates[severity] || templates.medium;
  const baseDescription = templateList[Math.floor(Math.random() * templateList.length)];

  // Add error-specific context
  let errorContext = '';
  if (weakTopic.dominant_error) {
    errorContext = ERROR_GOAL_ADDITIONS[weakTopic.dominant_error] || '';
  }

  // Add confidence-level context
  let confidenceContext = '';
  if (confidenceLevel === 'very_low') {
    confidenceContext = 'Start with foundational concepts before advancing';
  } else if (confidenceLevel === 'low') {
    confidenceContext = 'Build consistency through regular practice';
  }

  // Build full description
  let description = baseDescription;
  
  // Add specific failure context if available
  if (weakTopic.failed_count && weakTopic.failed_count > 5) {
    description += ` (addressing ${weakTopic.failed_count} failed attempts)`;
  }

  return {
    main: description,
    error_focus: errorContext,
    confidence_focus: confidenceContext,
    full: [description, errorContext, confidenceContext].filter(Boolean).join('. ')
  };
}

/**
 * Generate actionable milestones for a goal
 */
function generateMilestones(topic, currentScore, targetScore, deadlineDays, severity) {
  const milestones = [];
  const gap = targetScore - currentScore;
  const numMilestones = Math.min(4, Math.ceil(deadlineDays / 3));

  const milestoneActions = {
    'Dynamic Programming': [
      'Complete 2 basic DP problems',
      'Solve 3 medium DP problems',
      'Implement memoization from scratch',
      'Optimize space in a DP solution'
    ],
    'Arrays & Hashing': [
      'Master Two Sum variations',
      'Complete 3 frequency problems',
      'Solve 2 in-place modification problems',
      'Implement custom hash solution'
    ],
    'Binary Search': [
      'Perfect the basic BS template',
      'Solve 3 search space problems',
      'Handle 2 rotated array problems',
      'Implement BS on answer problems'
    ],
    'Trees': [
      'Complete all 3 traversals confidently',
      'Solve 3 tree property problems',
      'Implement 2 path sum variations',
      'Build tree from traversals'
    ],
    'Graphs': [
      'Master BFS on grid problems',
      'Implement DFS with cycle detection',
      'Solve 2 topological sort problems',
      'Complete a shortest path problem'
    ]
  };

  const actions = milestoneActions[topic] || [
    `Complete ${Math.ceil(gap/10)} easy ${topic} problems`,
    `Achieve 60% success in ${topic}`,
    `Solve ${Math.ceil(gap/8)} medium ${topic} problems`,
    `Reach target mastery level`
  ];

  for (let i = 1; i <= numMilestones; i++) {
    const progress = i / numMilestones;
    const targetAtMilestone = Math.round(currentScore + (gap * progress));
    const dayAtMilestone = Math.round(deadlineDays * progress);

    milestones.push({
      day: dayAtMilestone,
      target_score: targetAtMilestone,
      checkpoint: `Reach ${targetAtMilestone}% success rate`,
      action: actions[i - 1] || `Continue practicing ${topic}`,
      status: 'pending'
    });
  }

  return milestones;
}

/**
 * Main goal setting function (Enhanced)
 */
function setGoals(input) {
  const { 
    weak_topics, 
    confidence_scores, 
    error_patterns = [], 
    confidence_level = 'medium',
    learning_velocity = {},
    total_submissions = 0,
    llm_mistakes = []  // Optional: from GROQ LLM analysis
  } = input;

  if (!weak_topics || weak_topics.length === 0) {
    return {
      goals: [],
      priority_order: [],
      message: 'No weak areas detected. Great job! Consider challenging yourself with harder problems.',
      summary: {
        status: 'excellent',
        recommendation: 'Focus on maintaining your skills and exploring new topics.'
      },
      timestamp: new Date().toISOString(),
      status: 'no_goals_needed'
    };
  }

  const goals = [];

  // Process each weak topic
  for (const topic of weak_topics) {
    const currentScore = topic.score;
    const severity = topic.severity || 'medium';

    const targetScore = calculateTargetScore(currentScore, severity, learning_velocity);
    const deadlineDays = calculateDeadline(currentScore, targetScore, severity, learning_velocity);
    const milestones = generateMilestones(topic.topic, currentScore, targetScore, deadlineDays, severity);
    const description = generateGoalDescription(
      topic.topic, 
      severity, 
      topic, 
      error_patterns, 
      confidence_level
    );

    // Calculate priority (lower score + higher severity = higher priority)
    const severityWeight = { critical: 3, high: 2, medium: 1 };
    const priority = (100 - currentScore) * (severityWeight[severity] || 1);

    // Find related errors for this topic
    const relatedErrors = error_patterns.filter(e => 
      e.affected_topics?.includes(topic.topic)
    );

    goals.push({
      id: `goal_${topic.topic.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      topic: topic.topic,
      description: description.full,
      description_parts: description,
      current_score: currentScore,
      target_score: targetScore,
      deadline_days: deadlineDays,
      deadline_date: new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      severity,
      priority,
      milestones,
      related_errors: relatedErrors.map(e => e.error_type),
      trend: topic.trend || 'unknown',
      strategy: topic.strategy || `Focus on ${topic.topic} fundamentals`,
      metrics: {
        gap: targetScore - currentScore,
        improvement_rate_needed: Math.round((targetScore - currentScore) / deadlineDays * 10) / 10,
        problems_to_solve: Math.ceil((targetScore - currentScore) / 5) // Roughly 5% per problem
      },
      status: 'active',
      created_at: new Date().toISOString()
    });
  }

  // Sort by priority (highest first)
  goals.sort((a, b) => b.priority - a.priority);

  // ============================================
  // LLM-ENHANCED GOALS (optional, additive)
  // Convert unique LLM mistakes into skill-improvement goals
  // ============================================
  if (llm_mistakes && llm_mistakes.length > 0) {
    const existingTopics = new Set(goals.map(g => g.topic));
    const uniqueMistakes = [...new Set(llm_mistakes)]
      .filter(m => m && m.length > 5) // Filter out noise
      .slice(0, 3); // Max 3 LLM-derived goals

    for (const mistake of uniqueMistakes) {
      // Don't add if we already have a goal covering this topic area
      const alreadyCovered = [...existingTopics].some(topic =>
        mistake.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
      );
      if (alreadyCovered) continue;

      goals.push({
        id: `goal_llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        topic: 'AI-Identified Skill Gap',
        description: `Address: ${mistake}`,
        description_parts: { main: mistake, error_focus: '', confidence_focus: '', full: mistake },
        current_score: 50,
        target_score: 75,
        deadline_days: 7,
        deadline_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        severity: 'medium',
        priority: 10, // Lower priority than rule-based goals
        milestones: [],
        related_errors: [],
        trend: 'unknown',
        strategy: mistake,
        metrics: { gap: 25, improvement_rate_needed: 3.6, problems_to_solve: 5 },
        status: 'active',
        source: 'llm',
        created_at: new Date().toISOString()
      });
    }
  }

  // Assign rank
  goals.forEach((goal, index) => {
    goal.rank = index + 1;
  });

  // Create priority order
  const priority_order = goals.map(g => g.topic);

  // Generate personalized summary
  const summary = generateGoalsSummary(goals, confidence_level, learning_velocity);

  return {
    goals,
    priority_order,
    total_goals: goals.length,
    most_critical: goals[0]?.topic || null,
    estimated_total_days: Math.max(...goals.map(g => g.deadline_days)),
    summary,
    timestamp: new Date().toISOString(),
    status: 'goals_set'
  };
}

/**
 * Generate a personalized summary of goals
 */
function generateGoalsSummary(goals, confidenceLevel, learningVelocity) {
  const criticalCount = goals.filter(g => g.severity === 'critical').length;
  const primaryGoal = goals[0];

  let statusMessage = '';
  let focusAdvice = '';

  if (criticalCount > 2) {
    statusMessage = 'Multiple areas need significant attention';
    focusAdvice = `Start with ${primaryGoal?.topic} as your highest priority. Take it one step at a time.`;
  } else if (criticalCount === 1) {
    statusMessage = 'One critical area identified for improvement';
    focusAdvice = `Focus intensively on ${primaryGoal?.topic} this week before moving to other areas.`;
  } else if (goals.length > 3) {
    statusMessage = 'Several areas could use improvement';
    focusAdvice = `Prioritize the top 2-3 goals. Don't spread yourself too thin.`;
  } else {
    statusMessage = 'A few targeted improvements will boost your skills';
    focusAdvice = `You're on a good track. Focus on ${primaryGoal?.topic} for the best results.`;
  }

  // Add velocity-based advice
  if (learningVelocity?.direction === 'accelerating') {
    focusAdvice += ' Your recent improvement is excellent - keep up the momentum!';
  } else if (learningVelocity?.direction === 'declining') {
    focusAdvice += ' Consider reviewing fundamentals and taking breaks to avoid burnout.';
  }

  return {
    status: statusMessage,
    focus: focusAdvice,
    confidence_assessment: confidenceLevel,
    primary_focus: primaryGoal?.topic || 'General practice',
    estimated_completion: `${Math.max(...goals.map(g => g.deadline_days))} days`
  };
}

/**
 * Update goal progress
 */
function updateGoalProgress(goal, newScore) {
  const updated = { ...goal };
  updated.current_score = newScore;
  updated.metrics.gap = goal.target_score - newScore;

  // Check if goal is achieved
  if (newScore >= goal.target_score) {
    updated.status = 'completed';
    updated.completed_at = new Date().toISOString();
  }

  // Update milestone statuses
  updated.milestones = goal.milestones.map(m => ({
    ...m,
    status: newScore >= m.target_score ? 'achieved' : 'pending'
  }));

  return updated;
}

export { setGoals, updateGoalProgress, calculateTargetScore };
