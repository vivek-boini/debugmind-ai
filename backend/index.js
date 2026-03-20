const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 4000;

// Import agent system
const { orchestrator, memory, logger } = require('./services');
const agents = require('./agents');

// ============================================
// MIDDLEWARE
// ============================================

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`;

    if (res.statusCode >= 400) {
      console.error(log);
    } else {
      console.log(log);
    }
  });

  next();
});

// Request validation middleware
const validateUserId = (req, res, next) => {
  const userId = req.params.userId || req.body.userId || req.body.username;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid user ID',
      message: 'User ID must be a non-empty string'
    });
  }

  // Sanitize userId
  req.userId = userId.toLowerCase().trim();
  next();
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function extractUsername(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'u' || parts[0] === 'profile')) return parts[1];
    return parts[parts.length - 1] || 'sample_user';
  } catch (e) {
    return 'sample_user';
  }
}

function getStrategyForTopic(topic) {
  const strategies = {
    'Dynamic Programming': 'Practice memoization patterns and state transitions',
    'Arrays & Hashing': 'Focus on two-pointer and hash map techniques',
    'Binary Search': 'Identify search space and boundary conditions',
    'Sliding Window': 'Practice variable-size window problems',
    'Linked List': 'Draw diagrams and track pointer movements',
    'Trees': 'Master recursive thinking and level-order traversal',
    'Graphs': 'Practice BFS/DFS templates thoroughly',
    'Backtracking': 'Build decision trees and track choices',
    'Stack & Queue': 'Identify LIFO/FIFO patterns in problems',
    'Greedy': 'Prove greedy choice property before implementing',
    'General Problem Solving': 'Break down problems into smaller parts'
  };
  return strategies[topic] || 'Focus on understanding patterns and practice consistently';
}

function getRecommendedProblems(state) {
  if (!state.current_plan || !state.current_plan.plan) {
    return ['Two Sum', 'Valid Parentheses', 'Merge Two Sorted Lists'];
  }
  const today = orchestrator.getTodaysPlan(state.user_id);
  const problems = today.items.flatMap(item => item.problems?.map(p => p.title || p) || []);
  return problems.length > 0 ? problems : ['Practice problems from your plan'];
}

// ============================================
// CORE ROUTES
// ============================================

/**
 * POST /extract
 * Receives data from Chrome Extension and triggers agent loop
 */
app.post('/extract', async (req, res) => {
  const { username, submissions } = req.body || {};

  if (!username || !submissions || !Array.isArray(submissions)) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Missing or invalid username or submissions data',
      required: { username: 'string', submissions: 'array' }
    });
  }

  if (submissions.length === 0) {
    return res.status(400).json({
      error: 'Empty submissions',
      message: 'At least one submission is required'
    });
  }

  // Sanitize username - lowercase and trim
  const sanitizedUsername = username.toLowerCase().trim();
  console.log(`[Extract] Received data for user: ${sanitizedUsername} (original: ${username})`);
  console.log(`[Extract] Processing ${submissions.length} submissions`);

  try {
    const loopResult = await orchestrator.runFullLoop(sanitizedUsername, submissions);

    console.log(`[Extract] Agent loop completed for: ${sanitizedUsername}`);
    console.log(`[Extract] Goals: ${loopResult.goals?.length || 0}, Plan days: ${loopResult.plan?.plan?.length || 0}`);

    res.json({
      status: 'success',
      user_id: sanitizedUsername,
      received: submissions.length,
      agent_loop: loopResult,
      next_action: loopResult.next_action,
      alerts: loopResult.alerts,
      message: 'Agent loop executed successfully'
    });
  } catch (error) {
    console.error('[Extract] Error:', error);
    res.status(500).json({ error: 'Failed to process submissions', details: error.message });
  }
});

/**
 * POST /analyze
 * Returns dashboard-ready insights with full agent state
 */
app.post('/analyze', async (req, res) => {
  const { profileUrl } = req.body || {};

  if (!profileUrl) {
    return res.status(400).json({ error: 'Profile URL is required' });
  }

  const user = extractUsername(profileUrl);
  const state = memory.getState(user);

  if (state.submissions && state.submissions.length > 0) {
    console.log(`[Engine] Running agent analysis for: ${user}`);

    if (!state.diagnosis) {
      await orchestrator.runFullLoop(user, state.submissions);
    }

    const agentState = orchestrator.getAgentState(user);

    return res.json({
      user: user,
      agent_state: `Active - ${agentState.current_stage}`,
      weak_topics: state.diagnosis?.weak_topics?.map(wt => ({
        topic: wt.topic,
        confidence: wt.score,
        evidence: wt.evidence,
        goal: state.goals?.find(g => g.topic === wt.topic)?.target_score
          ? `Reach ${state.goals.find(g => g.topic === wt.topic).target_score}% success`
          : 'Improve consistency',
        strategy: getStrategyForTopic(wt.topic)
      })) || [],
      recommended_problems: getRecommendedProblems(state),
      agentic: {
        goals: state.goals,
        plan: state.current_plan,
        progress: state.current_progress,
        adaptation: state.current_adaptation,
        loop_status: agentState.current_stage,
        metrics: agentState.metrics,
        next_action: agentState.next_action,
        alerts: agentState.alerts,
        decision_timeline: agentState.decision_timeline,
        confidence_history: agentState.confidence_history,
        strategy_evolution: agentState.strategy_evolution
      }
    });
  }

  // Fallback Simulation
  console.log(`[Engine] No real data for ${user}. Returning simulation.`);
  res.json({
    user: user,
    agent_state: 'Simulation Mode',
    weak_topics: [{
      topic: 'Data Structure Selection',
      confidence: 65,
      evidence: ['Reliance on Array-based solutions', 'Limited usage of Map/Set observed'],
      goal: 'Incorporate O(1) lookups in solving patterns',
      strategy: 'Focus on problems requiring efficient lookup and mapping.'
    }],
    recommended_problems: ['Merge Sorted Array', 'Binary Tree Inorder Traversal'],
    agentic: null
  });
});

// ============================================
// AGENT STATE ROUTES
// ============================================

/**
 * GET /agent-state/:userId
 * Returns full agent state with explainability data
 * Includes status flag for frontend to detect if data exists
 */
app.get('/agent-state/:userId', validateUserId, (req, res) => {
  console.log(`[Agent State] Fetching state for user: ${req.userId}`);

  const state = memory.getState(req.userId);
  const hasData = state.submissions && state.submissions.length > 0;

  if (!hasData) {
    console.log(`[Agent State] No data found for user: ${req.userId}`);
    return res.json({
      status: 'no_data',
      message: 'No submissions data found. Please use the Chrome extension to extract your LeetCode data.',
      user_id: req.userId
    });
  }

  console.log(`[Agent State] Returning data for: ${req.userId} (${state.submissions.length} submissions)`);

  const agentState = orchestrator.getAgentState(req.userId);

  res.json({
    status: 'ready',
    ...agentState,
    user_id: req.userId,
    submissions_count: state.submissions.length
  });
});

/**
 * POST /update-progress
 * Accept new submissions and run incremental update
 */
app.post('/update-progress', async (req, res) => {
  const { username, submissions } = req.body || {};

  if (!username || !submissions || !Array.isArray(submissions)) {
    return res.status(400).json({ error: 'Missing username or submissions' });
  }

  console.log(`[Agent System] Incremental update for: ${username}`);

  try {
    const result = await orchestrator.runIncrementalUpdate(username, submissions);
    const state = orchestrator.getAgentState(username);

    res.json({
      status: 'success',
      update_result: result,
      current_state: state,
      next_action: result.next_action,
      alerts: result.alerts,
      strategy_evolution: result.strategy_evolution
    });
  } catch (error) {
    console.error('[Update Progress] Error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ============================================
// EXPLAINABILITY ROUTES (NEW)
// ============================================

/**
 * GET /agent-logs/:userId
 * Get agent decision logs for explainability
 */
app.get('/agent-logs/:userId', validateUserId, (req, res) => {
  const { agent, limit, since } = req.query;

  const options = {};
  if (agent) options.agent = agent;
  if (limit) options.limit = parseInt(limit, 10);
  if (since) options.since = since;

  const logs = orchestrator.getAgentLogs(req.userId, options);
  const stats = orchestrator.getLogStats(req.userId);

  res.json({
    logs,
    stats,
    timeline: logger.getDecisionTimeline(req.userId, parseInt(limit, 10) || 20)
  });
});

/**
 * GET /confidence-history/:userId
 * Get confidence score evolution over time
 */
app.get('/confidence-history/:userId', validateUserId, (req, res) => {
  const { topic } = req.query;
  const history = orchestrator.getConfidenceHistory(req.userId, topic || null);

  res.json(history);
});

/**
 * GET /next-action/:userId
 * Get recommended next action
 */
app.get('/next-action/:userId', validateUserId, (req, res) => {
  const state = memory.getState(req.userId);
  const agentState = orchestrator.getAgentState(req.userId);

  res.json({
    next_action: agentState.next_action,
    alerts: agentState.alerts,
    quick_stats: agentState.quick_stats
  });
});

/**
 * GET /strategy-evolution/:userId
 * Get before/after strategy comparison
 */
app.get('/strategy-evolution/:userId', validateUserId, (req, res) => {
  const state = memory.getState(req.userId);
  const agentState = orchestrator.getAgentState(req.userId);

  res.json({
    current_strategy: state.current_adaptation,
    evolution: agentState.strategy_evolution,
    adaptation_history: state.adaptations?.slice(-10) || []
  });
});

/**
 * GET /alerts/:userId
 * Get smart alerts for user
 */
app.get('/alerts/:userId', validateUserId, (req, res) => {
  const agentState = orchestrator.getAgentState(req.userId);

  res.json({
    alerts: agentState.alerts || [],
    timestamp: new Date().toISOString()
  });
});

// ============================================
// GOALS & PLAN ROUTES
// ============================================

app.get('/goals/:userId', validateUserId, (req, res) => {
  const state = memory.getState(req.userId);
  res.json({
    goals: state.goals || [],
    priority_order: state.goals?.map(g => g.topic) || [],
    timestamp: state.updated_at
  });
});

app.get('/plan/:userId', validateUserId, (req, res) => {
  const state = memory.getState(req.userId);
  res.json({
    plan: state.current_plan || null,
    today: orchestrator.getTodaysPlan(req.userId)
  });
});

app.post('/plan/:userId/advance', validateUserId, (req, res) => {
  const result = orchestrator.advanceDay(req.userId);
  res.json(result || { error: 'No active plan' });
});

app.get('/progress/:userId', validateUserId, (req, res) => {
  const state = memory.getState(req.userId);
  const agentState = orchestrator.getAgentState(req.userId);

  res.json({
    current: state.current_progress,
    history: state.progress_history || [],
    metrics: state.metrics,
    chart_data: agentState.confidence_history?.chart_data || null,
    overall_trend: agentState.confidence_history?.overall_trend || null
  });
});

app.get('/adaptation/:userId', validateUserId, (req, res) => {
  const state = memory.getState(req.userId);
  const agentState = orchestrator.getAgentState(req.userId);

  res.json({
    current: state.current_adaptation || null,
    history: state.adaptations || [],
    evolution: agentState.strategy_evolution
  });
});

// ============================================
// AGENT CONTROL ROUTES
// ============================================

app.post('/trigger-agent', async (req, res) => {
  const { userId, agent } = req.body || {};

  if (!userId || !agent) {
    return res.status(400).json({ error: 'Missing userId or agent name' });
  }

  const validAgents = ['diagnose', 'goals', 'plan', 'monitor', 'adapt'];
  if (!validAgents.includes(agent)) {
    return res.status(400).json({
      error: `Invalid agent. Must be one of: ${validAgents.join(', ')}`
    });
  }

  try {
    const result = await orchestrator.triggerAgent(userId, agent);
    res.json({ agent, result });
  } catch (error) {
    console.error('[Trigger Agent] Error:', error);
    res.status(500).json({ error: 'Failed to trigger agent' });
  }
});

app.post('/re-diagnose/:userId', validateUserId, async (req, res) => {
  try {
    const result = await orchestrator.reDiagnose(req.userId);
    res.json(result);
  } catch (error) {
    console.error('[Re-diagnose] Error:', error);
    res.status(500).json({ error: 'Failed to re-diagnose' });
  }
});

// ============================================
// SYSTEM ROUTES
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'DebugMind AI - Agentic Learning System',
    version: '2.1.0',
    features: [
      'Agent Decision Logging',
      'Confidence Tracking',
      'Strategy Evolution',
      'Smart Alerts',
      'Next Action Recommendations'
    ],
    agents: ['diagnosis', 'goal', 'planning', 'monitoring', 'adaptation'],
    timestamp: new Date().toISOString()
  });
});

app.get('/api-docs', (req, res) => {
  res.json({
    version: '2.1.0',
    endpoints: {
      core: [
        { method: 'POST', path: '/extract', description: 'Extract submissions and run agent loop' },
        { method: 'POST', path: '/analyze', description: 'Get analysis dashboard data' }
      ],
      state: [
        { method: 'GET', path: '/agent-state/:userId', description: 'Get full agent state' },
        { method: 'POST', path: '/update-progress', description: 'Submit new data for incremental update' }
      ],
      explainability: [
        { method: 'GET', path: '/agent-logs/:userId', description: 'Get agent decision logs' },
        { method: 'GET', path: '/confidence-history/:userId', description: 'Get confidence evolution' },
        { method: 'GET', path: '/next-action/:userId', description: 'Get recommended next action' },
        { method: 'GET', path: '/strategy-evolution/:userId', description: 'Get strategy changes' },
        { method: 'GET', path: '/alerts/:userId', description: 'Get smart alerts' }
      ],
      planning: [
        { method: 'GET', path: '/goals/:userId', description: 'Get learning goals' },
        { method: 'GET', path: '/plan/:userId', description: 'Get learning plan' },
        { method: 'POST', path: '/plan/:userId/advance', description: 'Advance to next day' },
        { method: 'GET', path: '/progress/:userId', description: 'Get progress history' },
        { method: 'GET', path: '/adaptation/:userId', description: 'Get adaptation state' }
      ],
      control: [
        { method: 'POST', path: '/trigger-agent', description: 'Manually trigger an agent' },
        { method: 'POST', path: '/re-diagnose/:userId', description: 'Force re-diagnosis' }
      ],
      debug: [
        { method: 'GET', path: '/debug-cache', description: 'View all cached user data (debug only)' }
      ]
    }
  });
});

/**
 * GET /debug-cache
 * Debug endpoint to view all cached user data
 * WARNING: For development only - disable in production
 */
app.get('/debug-cache', (req, res) => {
  const allUsers = memory.getAllUsers ? memory.getAllUsers() : {};

  const summary = {};
  for (const [userId, state] of Object.entries(allUsers)) {
    summary[userId] = {
      hasSubmissions: !!(state.submissions && state.submissions.length > 0),
      submissionsCount: state.submissions?.length || 0,
      hasDiagnosis: !!state.diagnosis,
      goalsCount: state.goals?.length || 0,
      hasPlan: !!state.current_plan,
      hasProgress: !!state.current_progress,
      updatedAt: state.updated_at
    };
  }

  console.log('[Debug] Cache state:', summary);

  res.json({
    timestamp: new Date().toISOString(),
    userCount: Object.keys(summary).length,
    users: summary
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🧠 DebugMind AI - Agentic Learning System v2.1              ║
║                                                               ║
║   Server: http://localhost:${port}                              ║
║   API Docs: http://localhost:${port}/api-docs                   ║
║                                                               ║
║   ┌─────────────────────────────────────────────────────────┐ ║
║   │ AGENT LOOP                                              │ ║
║   │ Extract → Diagnose → Goal → Plan → Monitor → Adapt      │ ║
║   └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║   Features:                                                   ║
║   ✓ Decision Logging & Explainability                         ║
║   ✓ Confidence Tracking Over Time                             ║
║   ✓ Strategy Evolution Visualization                          ║
║   ✓ Smart Alerts System                                       ║
║   ✓ Next Action Recommendations                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
