/**
 * Monitoring Agent
 * Tracks user progress and detects patterns
 *
 * Input: { new_submissions, previous_progress, goals }
 * Output: { progress, status, trends, alerts }
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

/**
 * Calculate success rate from submissions
 */
function calculateSuccessRate(submissions) {
  if (!submissions || submissions.length === 0) return 0;

  const accepted = submissions.filter(s => s.statusDisplay === 'Accepted').length;
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
      message: `Success rate improved by ${delta}%`
    };
  } else if (delta > 5) {
    return {
      direction: 'slightly_improving',
      confidence: 'medium',
      delta,
      message: `Slight improvement of ${delta}%`
    };
  } else if (delta < -10) {
    return {
      direction: 'declining',
      confidence: 'high',
      delta,
      message: `Success rate dropped by ${Math.abs(delta)}%`
    };
  } else if (delta < -5) {
    return {
      direction: 'slightly_declining',
      confidence: 'medium',
      delta,
      message: `Slight decline of ${Math.abs(delta)}%`
    };
  } else {
    return {
      direction: 'stable',
      confidence: 'medium',
      delta,
      message: 'Performance is stable'
    };
  }
}

/**
 * Analyze progress by topic
 */
function analyzeTopicProgress(submissions, topic, classifier) {
  const topicSubmissions = submissions.filter(s => {
    const classified = classifier ? classifier(s.title) : 'General';
    return classified === topic;
  });

  if (topicSubmissions.length === 0) {
    return null;
  }

  const accepted = topicSubmissions.filter(s => s.statusDisplay === 'Accepted').length;
  const failed = topicSubmissions.length - accepted;

  return {
    topic,
    attempts: topicSubmissions.length,
    accepted,
    failed,
    success_rate: Math.round((accepted / topicSubmissions.length) * 100),
    problems_attempted: [...new Set(topicSubmissions.map(s => s.title))]
  };
}

/**
 * Check goal progress
 */
function checkGoalProgress(goal, currentTopicProgress) {
  if (!currentTopicProgress) {
    return {
      goal_id: goal.id,
      topic: goal.topic,
      status: 'no_activity',
      message: 'No submissions for this topic yet'
    };
  }

  const currentScore = currentTopicProgress.success_rate;
  const progressMade = currentScore - goal.current_score;
  const progressNeeded = goal.target_score - currentScore;
  const progressPercent = Math.round((progressMade / (goal.target_score - goal.current_score)) * 100);

  let status;
  if (currentScore >= goal.target_score) {
    status = 'goal_achieved';
  } else if (progressPercent >= 75) {
    status = 'almost_there';
  } else if (progressPercent >= 50) {
    status = 'on_track';
  } else if (progressPercent >= 25) {
    status = 'needs_attention';
  } else {
    status = 'behind';
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
    days_remaining: goal.deadline_days, // This should be calculated from actual dates
    on_track: status === 'on_track' || status === 'almost_there' || status === 'goal_achieved'
  };
}

/**
 * Generate alerts based on monitoring
 */
function generateAlerts(progress, trend, goalProgress) {
  const alerts = [];

  // Success rate alerts
  if (progress.success_rate < 30) {
    alerts.push({
      type: 'critical',
      category: 'performance',
      message: 'Success rate is critically low',
      suggestion: 'Consider stepping back to easier problems'
    });
  } else if (progress.success_rate < 50) {
    alerts.push({
      type: 'warning',
      category: 'performance',
      message: 'Success rate needs improvement',
      suggestion: 'Focus on understanding patterns before attempting more problems'
    });
  }

  // Trend alerts
  if (trend.direction === 'declining') {
    alerts.push({
      type: 'warning',
      category: 'trend',
      message: 'Performance is declining',
      suggestion: 'Take a break or review fundamentals'
    });
  }

  // Goal progress alerts
  if (goalProgress) {
    goalProgress.forEach(gp => {
      if (gp.status === 'behind') {
        alerts.push({
          type: 'warning',
          category: 'goal',
          message: `Behind on ${gp.topic} goal`,
          suggestion: 'Increase daily practice or adjust timeline'
        });
      } else if (gp.status === 'goal_achieved') {
        alerts.push({
          type: 'success',
          category: 'goal',
          message: `Goal achieved for ${gp.topic}!`,
          suggestion: 'Consider setting a new, more challenging goal'
        });
      }
    });
  }

  // Activity alerts
  if (progress.attempts < 3) {
    alerts.push({
      type: 'info',
      category: 'activity',
      message: 'Low activity detected',
      suggestion: 'Try to maintain consistent daily practice'
    });
  }

  return alerts;
}

/**
 * Calculate streaks
 */
function calculateStreaks(submissions) {
  if (!submissions || submissions.length === 0) {
    return { current: 0, longest: 0, days_active: 0 };
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

  return {
    current: activeDays.size > 0 ? 1 : 0, // Simplified
    longest: activeDays.size,
    days_active: activeDays.size
  };
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
        message: 'No new submissions to analyze',
        suggestion: 'Start practicing to see your progress'
      }],
      timestamp: new Date().toISOString()
    };
  }

  // Calculate current progress
  const accepted = new_submissions.filter(s => s.statusDisplay === 'Accepted').length;
  const failed = new_submissions.length - accepted;
  const successRate = calculateSuccessRate(new_submissions);

  const progress = {
    success_rate: successRate,
    attempts: new_submissions.length,
    accepted,
    failed,
    unique_problems: [...new Set(new_submissions.map(s => s.title))].length
  };

  // Calculate trend
  const previousRate = previous_progress?.success_rate || 0;
  const trend = detectTrend(successRate, previousRate, new_submissions.length);

  // Determine overall status
  let status;
  if (successRate >= 70 && trend.direction.includes('improving')) {
    status = 'excelling';
  } else if (successRate >= 60 || trend.direction.includes('improving')) {
    status = 'improving';
  } else if (successRate >= 40) {
    status = 'stable';
  } else if (trend.direction.includes('declining')) {
    status = 'struggling';
  } else {
    status = 'needs_focus';
  }

  // Check goal progress
  const goalProgress = (goals || []).map(goal => {
    const topicProgress = analyzeTopicProgress(new_submissions, goal.topic, classifyProblem);
    return checkGoalProgress(goal, topicProgress);
  });

  // Calculate streaks
  const streaks = calculateStreaks(new_submissions);

  // Generate alerts
  const alerts = generateAlerts(progress, trend, goalProgress);

  return {
    progress,
    status,
    status_emoji: getStatusEmoji(status),
    trend,
    goal_progress: goalProgress,
    streaks,
    alerts,
    by_topic: analyzeByTopic(new_submissions, classifyProblem),
    timestamp: new Date().toISOString()
  };
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
 * Analyze submissions by topic
 */
function analyzeByTopic(submissions, classifyProblem) {
  if (!classifyProblem) return {};

  const byTopic = {};
  submissions.forEach(sub => {
    const topic = classifyProblem(sub.title);
    if (!byTopic[topic]) {
      byTopic[topic] = { attempts: 0, accepted: 0 };
    }
    byTopic[topic].attempts++;
    if (sub.statusDisplay === 'Accepted') {
      byTopic[topic].accepted++;
    }
  });

  // Calculate rates
  Object.keys(byTopic).forEach(topic => {
    byTopic[topic].success_rate = Math.round(
      (byTopic[topic].accepted / byTopic[topic].attempts) * 100
    );
  });

  return byTopic;
}

export { monitor, calculateSuccessRate, detectTrend };
