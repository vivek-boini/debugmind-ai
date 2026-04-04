/**
 * Confidence Tracker
 * Tracks evolution of skill scores and confidence over time
 *
 * Features:
 * - Per-topic confidence history
 * - Trend detection
 * - Progress visualization data
 */

// In-memory confidence history store
const confidenceStore = new Map();

/**
 * Initialize confidence store for user
 */
function initializeUser(userId) {
  const normalizedId = userId.toLowerCase();

  if (!confidenceStore.has(normalizedId)) {
    confidenceStore.set(normalizedId, {
      topics: {},
      overall: [],
      created_at: new Date().toISOString()
    });
  }

  return confidenceStore.get(normalizedId);
}

/**
 * Record confidence scores from diagnosis
 */
function recordConfidence(userId, confidenceScores, overallRate) {
  const normalizedId = userId.toLowerCase();
  const store = initializeUser(normalizedId);
  const timestamp = new Date().toISOString();

  // Record per-topic confidence
  for (const [topic, score] of Object.entries(confidenceScores)) {
    if (!store.topics[topic]) {
      store.topics[topic] = [];
    }

    store.topics[topic].push({
      score,
      timestamp,
      change: calculateChange(store.topics[topic], score)
    });

    // Keep last 50 records per topic
    if (store.topics[topic].length > 50) {
      store.topics[topic].shift();
    }
  }

  // Record overall confidence
  store.overall.push({
    score: overallRate,
    timestamp,
    change: calculateChange(store.overall, overallRate)
  });

  if (store.overall.length > 100) {
    store.overall.shift();
  }

  confidenceStore.set(normalizedId, store);

  return store;
}

/**
 * Calculate change from previous value
 */
function calculateChange(history, newScore) {
  if (history.length === 0) return 0;
  const lastScore = history[history.length - 1].score;
  return newScore - lastScore;
}

/**
 * Get confidence history for a user
 */
function getHistory(userId, options = {}) {
  const normalizedId = userId.toLowerCase();
  const store = confidenceStore.get(normalizedId);

  if (!store) {
    return {
      topics: {},
      overall: [],
      trends: {},
      summary: null
    };
  }

  // Filter by topic if specified
  let topicData = store.topics;
  if (options.topic) {
    topicData = { [options.topic]: store.topics[options.topic] || [] };
  }

  // Calculate trends
  const trends = {};
  for (const [topic, history] of Object.entries(topicData)) {
    trends[topic] = calculateTrend(history);
  }

  return {
    topics: topicData,
    overall: store.overall,
    trends,
    overall_trend: calculateTrend(store.overall),
    summary: generateSummary(store)
  };
}

/**
 * Calculate trend for a history array
 */
function calculateTrend(history) {
  if (!history || history.length < 2) {
    return {
      direction: 'insufficient_data',
      strength: 0,
      message: 'Need more data points'
    };
  }

  // Get recent scores (last 5)
  const recent = history.slice(-5);
  const changes = recent.map(h => h.change).filter(c => c !== undefined);

  if (changes.length < 2) {
    return {
      direction: 'stable',
      strength: 0,
      message: 'Not enough changes to determine trend'
    };
  }

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const firstScore = history[0].score;
  const lastScore = history[history.length - 1].score;
  const totalChange = lastScore - firstScore;

  let direction, strength, message;

  if (avgChange > 5) {
    direction = 'improving_fast';
    strength = Math.min(1, avgChange / 20);
    message = `Rapid improvement! +${Math.round(avgChange)}% per session`;
  } else if (avgChange > 2) {
    direction = 'improving';
    strength = avgChange / 10;
    message = `Steady improvement: +${Math.round(avgChange)}% per session`;
  } else if (avgChange < -5) {
    direction = 'declining_fast';
    strength = Math.min(1, Math.abs(avgChange) / 20);
    message = `Performance dropping: ${Math.round(avgChange)}% per session`;
  } else if (avgChange < -2) {
    direction = 'declining';
    strength = Math.abs(avgChange) / 10;
    message = `Slight decline: ${Math.round(avgChange)}% per session`;
  } else {
    direction = 'stable';
    strength = 0.5;
    message = 'Performance is consistent';
  }

  return {
    direction,
    strength: Math.round(strength * 100) / 100,
    message,
    avg_change: Math.round(avgChange * 10) / 10,
    total_change: totalChange,
    data_points: history.length
  };
}

/**
 * Generate summary statistics
 */
function generateSummary(store) {
  const topics = Object.entries(store.topics);

  if (topics.length === 0) {
    return null;
  }

  // Find most improved and most struggled topics
  let mostImproved = null;
  let mostStruggled = null;
  let maxImprovement = -Infinity;
  let maxStruggle = -Infinity;

  for (const [topic, history] of topics) {
    if (history.length < 2) continue;

    const trend = calculateTrend(history);
    const improvement = trend.total_change || 0;

    if (improvement > maxImprovement) {
      maxImprovement = improvement;
      mostImproved = { topic, improvement, current: history[history.length - 1].score };
    }

    if (improvement < 0 && Math.abs(improvement) > maxStruggle) {
      maxStruggle = Math.abs(improvement);
      mostStruggled = { topic, decline: improvement, current: history[history.length - 1].score };
    }
  }

  // Calculate overall stats
  const overallHistory = store.overall;
  const currentOverall = overallHistory.length > 0 ? overallHistory[overallHistory.length - 1].score : 0;
  const startOverall = overallHistory.length > 0 ? overallHistory[0].score : 0;

  return {
    total_topics: topics.length,
    most_improved: mostImproved,
    most_struggled: mostStruggled,
    overall: {
      current: currentOverall,
      start: startOverall,
      change: currentOverall - startOverall
    },
    data_points: store.overall.length
  };
}

/**
 * Get chart data for visualization
 */
function getChartData(userId, topic = null) {
  const normalizedId = userId.toLowerCase();
  const store = confidenceStore.get(normalizedId);

  if (!store) {
    return { labels: [], datasets: [] };
  }

  if (topic) {
    // Single topic chart
    const history = store.topics[topic] || [];
    return {
      labels: history.map(h => new Date(h.timestamp).toLocaleDateString()),
      datasets: [{
        label: topic,
        data: history.map(h => h.score),
        changes: history.map(h => h.change)
      }]
    };
  }

  // Overall chart with multiple topics
  const datasets = [];

  // Add overall
  datasets.push({
    label: 'Overall',
    data: store.overall.map(h => h.score),
    primary: true
  });

  // Add top 3 weak topics
  const topicEntries = Object.entries(store.topics)
    .filter(([_, h]) => h.length > 0)
    .sort((a, b) => a[1][a[1].length - 1].score - b[1][b[1].length - 1].score)
    .slice(0, 3);

  for (const [topicName, history] of topicEntries) {
    datasets.push({
      label: topicName,
      data: history.map(h => h.score)
    });
  }

  // Generate labels from overall timestamps
  const labels = store.overall.map((h, i) => {
    const date = new Date(h.timestamp);
    return `Session ${i + 1}`;
  });

  return { labels, datasets };
}

/**
 * Clear history for a user
 */
function clearHistory(userId) {
  const normalizedId = userId.toLowerCase();
  confidenceStore.delete(normalizedId);
  return true;
}

export {
  recordConfidence,
  getHistory,
  calculateTrend,
  getChartData,
  clearHistory
};
