/**
 * Goal Agent
 * Sets learning goals based on diagnosis results
 *
 * Input: { weak_topics, confidence_scores }
 * Output: { goals: [...], priority_order: [...] }
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

/**
 * Calculate appropriate target score
 */
function calculateTargetScore(currentScore, severity) {
  const config = TARGET_IMPROVEMENTS[severity] || TARGET_IMPROVEMENTS.medium;
  let target = currentScore + config.target_delta;

  // Clamp between min and max
  target = Math.max(MIN_TARGET_SCORE, Math.min(MAX_TARGET_SCORE, target));

  return target;
}

/**
 * Calculate deadline based on gap and severity
 */
function calculateDeadline(currentScore, targetScore, severity) {
  const gap = targetScore - currentScore;
  const baseConfig = TARGET_IMPROVEMENTS[severity] || TARGET_IMPROVEMENTS.medium;

  // Adjust deadline based on gap size
  let days = baseConfig.deadline_days;
  if (gap > 40) days += 5;
  if (gap > 50) days += 7;

  return days;
}

/**
 * Generate milestones for a goal
 */
function generateMilestones(currentScore, targetScore, deadlineDays) {
  const milestones = [];
  const gap = targetScore - currentScore;
  const numMilestones = Math.min(4, Math.ceil(deadlineDays / 3));

  for (let i = 1; i <= numMilestones; i++) {
    const progress = i / numMilestones;
    const targetAtMilestone = Math.round(currentScore + (gap * progress));
    const dayAtMilestone = Math.round(deadlineDays * progress);

    milestones.push({
      day: dayAtMilestone,
      target_score: targetAtMilestone,
      checkpoint: `Reach ${targetAtMilestone}% success rate`
    });
  }

  return milestones;
}

/**
 * Main goal setting function
 */
function setGoals(input) {
  const { weak_topics, confidence_scores, total_submissions = 0 } = input;

  if (!weak_topics || weak_topics.length === 0) {
    return {
      goals: [],
      priority_order: [],
      message: 'No weak areas detected. Great job!',
      timestamp: new Date().toISOString(),
      status: 'no_goals_needed'
    };
  }

  const goals = [];

  // Process each weak topic
  for (const topic of weak_topics) {
    const currentScore = topic.score;
    const severity = topic.severity || 'medium';

    const targetScore = calculateTargetScore(currentScore, severity);
    const deadlineDays = calculateDeadline(currentScore, targetScore, severity);
    const milestones = generateMilestones(currentScore, targetScore, deadlineDays);

    // Calculate priority (lower score + higher severity = higher priority)
    const severityWeight = { critical: 3, high: 2, medium: 1 };
    const priority = (100 - currentScore) * (severityWeight[severity] || 1);

    goals.push({
      id: `goal_${topic.topic.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      topic: topic.topic,
      current_score: currentScore,
      target_score: targetScore,
      deadline_days: deadlineDays,
      deadline_date: new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      severity,
      priority,
      milestones,
      metrics: {
        gap: targetScore - currentScore,
        improvement_rate_needed: Math.round((targetScore - currentScore) / deadlineDays * 10) / 10
      },
      status: 'active',
      created_at: new Date().toISOString()
    });
  }

  // Sort by priority (highest first)
  goals.sort((a, b) => b.priority - a.priority);

  // Assign rank
  goals.forEach((goal, index) => {
    goal.rank = index + 1;
  });

  // Create priority order
  const priority_order = goals.map(g => g.topic);

  return {
    goals,
    priority_order,
    total_goals: goals.length,
    most_critical: goals[0]?.topic || null,
    estimated_total_days: Math.max(...goals.map(g => g.deadline_days)),
    timestamp: new Date().toISOString(),
    status: 'goals_set'
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
    achieved: newScore >= m.target_score
  }));

  return updated;
}

module.exports = { setGoals, updateGoalProgress, calculateTargetScore };
