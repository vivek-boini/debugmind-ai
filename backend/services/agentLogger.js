/**
 * Agent Decision Logger
 * Tracks and stores every agent decision for explainability and debugging
 *
 * Features:
 * - Structured decision logging
 * - Human-readable explanations
 * - Confidence tracking
 * - Decision history queries
 */

// In-memory log store (per user)
const logStore = new Map();

// Log entry schema
const createLogEntry = ({
  agent,
  decision,
  reason,
  confidence,
  input_summary,
  output_summary,
  evidence = [],
  metadata = {}
}) => ({
  id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date().toISOString(),
  agent,
  decision,
  reason,
  confidence: Math.round(confidence * 100) / 100,
  input_summary,
  output_summary,
  evidence,
  metadata,
  human_readable: generateHumanReadable(agent, decision, reason, confidence)
});

/**
 * Generate human-readable explanation for a decision
 */
function generateHumanReadable(agent, decision, reason, confidence) {
  const templates = {
    diagnosisAgent: {
      analyzed: `Analyzed your submissions and identified patterns. ${reason}`,
      no_data: 'Waiting for submission data to analyze.',
      weak_topic_found: `Found a weak area that needs attention: ${reason}`
    },
    goalAgent: {
      goals_set: `Set learning goals based on identified weaknesses. ${reason}`,
      no_goals_needed: 'No weak areas found - you\'re doing great!',
      goal_prioritized: `Prioritized goals by urgency. ${reason}`
    },
    planningAgent: {
      plan_created: `Created a personalized learning plan. ${reason}`,
      plan_adjusted: `Adjusted your plan based on progress. ${reason}`,
      no_goals: 'Waiting for goals to create a plan.'
    },
    monitoringAgent: {
      improving: `Good news! Your performance is improving. ${reason}`,
      stable: `Your performance is steady. ${reason}`,
      declining: `Noticed some challenges. ${reason}`,
      excelling: `Excellent work! You're excelling. ${reason}`
    },
    adaptationAgent: {
      increase_difficulty: `You're ready for harder problems! ${reason}`,
      simplify_problems: `Let's build a stronger foundation first. ${reason}`,
      maintain_pace: `Keep up the good work with current approach. ${reason}`,
      change_strategy: `Trying a new approach to break through. ${reason}`,
      pause_and_review: `Taking time to consolidate what you've learned. ${reason}`
    }
  };

  const agentTemplates = templates[agent] || {};
  const template = agentTemplates[decision] || `${agent} made decision: ${decision}. ${reason}`;

  const confidenceText = confidence >= 0.8 ? 'high confidence' :
    confidence >= 0.6 ? 'moderate confidence' : 'exploring options';

  return `${template} (${confidenceText})`;
}

/**
 * Log an agent decision
 */
function logDecision(userId, logData) {
  const normalizedId = userId.toLowerCase();

  if (!logStore.has(normalizedId)) {
    logStore.set(normalizedId, []);
  }

  const entry = createLogEntry(logData);
  const logs = logStore.get(normalizedId);

  // Keep last 500 logs per user
  logs.push(entry);
  if (logs.length > 500) {
    logs.shift();
  }

  console.log(`[AgentLog] ${entry.agent}: ${entry.decision} (confidence: ${entry.confidence})`);

  return entry;
}

/**
 * Get logs for a user
 */
function getLogs(userId, options = {}) {
  const normalizedId = userId.toLowerCase();
  const logs = logStore.get(normalizedId) || [];

  let filtered = [...logs];

  // Filter by agent
  if (options.agent) {
    filtered = filtered.filter(l => l.agent === options.agent);
  }

  // Filter by time range
  if (options.since) {
    const sinceDate = new Date(options.since);
    filtered = filtered.filter(l => new Date(l.timestamp) >= sinceDate);
  }

  // Filter by decision type
  if (options.decision) {
    filtered = filtered.filter(l => l.decision === options.decision);
  }

  // Sort by timestamp (newest first)
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Limit results
  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Get decision timeline (for UI visualization)
 */
function getDecisionTimeline(userId, limit = 20) {
  const logs = getLogs(userId, { limit });

  return logs.map(log => ({
    id: log.id,
    timestamp: log.timestamp,
    agent: log.agent,
    decision: log.decision,
    human_readable: log.human_readable,
    confidence: log.confidence,
    icon: getAgentIcon(log.agent)
  }));
}

/**
 * Get agent icon for UI
 */
function getAgentIcon(agent) {
  const icons = {
    diagnosisAgent: '🔍',
    goalAgent: '🎯',
    planningAgent: '📅',
    monitoringAgent: '📊',
    adaptationAgent: '🔄'
  };
  return icons[agent] || '🤖';
}

/**
 * Get aggregated stats for logs
 */
function getLogStats(userId) {
  const logs = getLogs(userId);

  if (logs.length === 0) {
    return { total: 0, by_agent: {}, by_decision: {} };
  }

  const byAgent = {};
  const byDecision = {};
  let totalConfidence = 0;

  logs.forEach(log => {
    byAgent[log.agent] = (byAgent[log.agent] || 0) + 1;
    byDecision[log.decision] = (byDecision[log.decision] || 0) + 1;
    totalConfidence += log.confidence;
  });

  return {
    total: logs.length,
    by_agent: byAgent,
    by_decision: byDecision,
    avg_confidence: Math.round((totalConfidence / logs.length) * 100) / 100,
    first_log: logs[logs.length - 1]?.timestamp,
    last_log: logs[0]?.timestamp
  };
}

/**
 * Get recent adaptations summary
 */
function getAdaptationSummary(userId) {
  const adaptationLogs = getLogs(userId, { agent: 'adaptationAgent', limit: 10 });

  if (adaptationLogs.length === 0) {
    return null;
  }

  const latest = adaptationLogs[0];
  const previous = adaptationLogs[1];

  return {
    current: {
      action: latest.decision,
      reason: latest.reason,
      confidence: latest.confidence,
      timestamp: latest.timestamp,
      human_readable: latest.human_readable
    },
    previous: previous ? {
      action: previous.decision,
      reason: previous.reason,
      timestamp: previous.timestamp
    } : null,
    strategy_changes: adaptationLogs.filter(l =>
      l.decision !== 'maintain_pace'
    ).length,
    total_adaptations: adaptationLogs.length
  };
}

/**
 * Clear logs for a user
 */
function clearLogs(userId) {
  const normalizedId = userId.toLowerCase();
  logStore.set(normalizedId, []);
  return true;
}

/**
 * Export logs for debugging
 */
function exportLogs(userId) {
  return getLogs(userId);
}

module.exports = {
  logDecision,
  getLogs,
  getDecisionTimeline,
  getLogStats,
  getAdaptationSummary,
  clearLogs,
  exportLogs,
  generateHumanReadable
};
