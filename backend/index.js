// Load environment variables first
import 'dotenv/config';

import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4000;

// Import agent system
import { orchestrator, memory, logger, codeAnalysisService, llmService, dbService, authService, problemService } from './services/index.js';
import * as agents from './agents/index.js';
import { STAGES } from './services/agentOrchestrator.js';

// Initialize MongoDB connection (non-blocking)
dbService.initialize().then(connected => {
  if (connected) {
    console.log('[Server] MongoDB connected - persistence enabled');
  } else {
    console.log('[Server] Running without MongoDB - memory-only mode');
  }
}).catch(err => {
  console.warn('[Server] MongoDB init error (continuing without DB):', err.message);
});

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
 * 
 * MongoDB Integration:
 * - Creates a new Session record (append-only)
 * - Stores agent outputs after pipeline completes
 * - Updates submissions history
 * - Creates progress snapshot
 * - All DB operations are non-blocking (background)
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

  // Fix 1: PREVENT DOUBLE EXTRACTION (PIPELINE LOCK)
  if (!memory.tryStartPipeline(sanitizedUsername)) {
    console.log(`[Extract] Rejected overlapping extraction for: ${sanitizedUsername}`);
    return res.status(200).json({
      status: "processing",
      message: "Extraction already in progress",
      user_id: sanitizedUsername
    });
  }

  console.log(`[Extract] Received data for user: ${sanitizedUsername} (original: ${username})`);
  console.log(`[Extract] Processing ${submissions.length} submissions`);

  // Create session in MongoDB (non-blocking start)
  let sessionId = null;
  const sessionPromise = dbService.createSession(sanitizedUsername, submissions, {
    source: 'chrome-extension',
    extractionTimestamp: new Date()
  }).then(session => {
    if (session) {
      sessionId = session.sessionId;
      console.log(`[Extract] Session created: ${sessionId}`);
    }
    return session;
  }).catch(err => {
    console.warn('[Extract] Session creation failed (continuing):', err.message);
    return null;
  });

  try {
    // Notify frontend we've started via memory cache

    // Send immediate response so client unblocks
    res.json({
      status: 'processing',
      user_id: sanitizedUsername,
      received: submissions.length,
      message: 'Agent pipeline started in background',
      session_id: sessionId || null
    });

    // Fix 3: WAIT FOR PIPELINE COMPLETION (store status in memory)
    memory.updateState(sanitizedUsername, { status: "processing" });

    // Run agent loop and persistence non-blockingly
    process.nextTick(async () => {
      try {
        // Fix 3: Store submissions FIRST to check for new data
        const session = await sessionPromise;
        const capturedSessionId = session?.sessionId || null;

        let newSubmissionsCount = 0;
        if (session) {
          try {
            const storeResult = await dbService.storeSubmissionsAwaited(sanitizedUsername, submissions, capturedSessionId);
            newSubmissionsCount = storeResult?.newCount || 0;
            console.log(`[PIPELINE] Submissions stored. New: ${newSubmissionsCount}, Total sent: ${submissions.length}`);
          } catch (storeErr) {
            console.error('[PIPELINE] Submission storage failed:', storeErr.message);
          }
        }

        // Fix 3: If no new submissions, skip entire agent + LLM pipeline
        if (newSubmissionsCount === 0) {
          console.log("[Pipeline] No new submissions, but running pipeline anyway");
        }

        // STEP 5: Ensure pipeline only finishes AFTER everything is awaited sequentially
        console.log(`[PIPELINE] Agent started for: ${sanitizedUsername}`);
        
        let loopResult = await orchestrator.runFullLoop(sanitizedUsername, submissions);

        if (loopResult?.status === 'error') {
          console.error(`[PIPELINE] Agent failed for: ${sanitizedUsername}`, loopResult.errors);
        } else {
          console.log(`[PIPELINE] Agent success for: ${sanitizedUsername} — Goals: ${loopResult?.goals?.length || 0}`);
        }

        if (session) {
          // Submissions already stored at line 209 — DO NOT store again
          console.log(`[AsyncPipeline] Starting LLM & Enhanced Pipeline for ${sanitizedUsername}`);

          try {
            const titleSlugs = [...new Set(submissions.map(s => s.titleSlug).filter(Boolean))];
            if (titleSlugs.length > 0) {
              await problemService.fetchAndCacheProblems(titleSlugs);
            }
          } catch (problemErr) { console.error("Problem fetch error:", problemErr.message); }

          try {
            const llmResult = await codeAnalysisService.runLLMAnalysis(sanitizedUsername);
            if (llmResult && llmResult.analyzed > 0) {
              const enhancedResult = await orchestrator.runEnhancedAgentPipeline(sanitizedUsername, capturedSessionId);
              if (enhancedResult) {
                loopResult = enhancedResult; // override loopResult with enhanced
                console.log(`[AsyncPipeline] ✓ Enhanced pipeline complete for ${sanitizedUsername}`);
              }
            }
          } catch (pipelineErr) {
            console.error("[Pipeline Error]", pipelineErr);
          }

          // Persist FINAL extract data
          try {
            const persistResult = await dbService.persistExtractData(sanitizedUsername, submissions, loopResult, capturedSessionId);
            if (persistResult) {
              console.log(`[Extract] ✓ Data persisted for session: ${persistResult.sessionId}`);
              
              // Force AgentOutput update 
              const { AgentOutput } = await import('./services/mongoModels.js');
              await AgentOutput.updateOne(
                { userId: sanitizedUsername },
                { $set: { updatedAt: new Date() } }
              );
            }
          } catch (err) {
            console.error('[Extract] Persistence failed:', err.message);
          }
        }
      } catch (backgroundError) {
        console.error('[Extract] Background processing error:', backgroundError);
        if (sessionId) {
          dbService.updateSessionStatus(sessionId, 'failed', backgroundError.message).catch(() => { });
        }
      } finally {
        // NO async calls after this, correctly triggers UI
        memory.updateState(sanitizedUsername, { status: "ready" });
        memory.endPipeline(sanitizedUsername);
      }
    });

  } catch (error) {
    console.error('[Extract] Error:', error);

    // Update session status if we have one
    if (sessionId) {
      dbService.updateSessionStatus(sessionId, 'failed', error.message).catch(() => { });
    }

    res.status(500).json({ error: 'Failed to process submissions', details: error.message });
  }
});

/**
 * POST /code-analysis
 * DEPRECATED — LLM analysis now runs automatically during /extract
 * Kept for backward compat: returns deprecation message instead of crashing
 */
app.post('/code-analysis', async (req, res) => {
  console.warn('[DEPRECATED] POST /code-analysis called — LLM analysis now runs automatically during /extract.');

  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const sanitizedUsername = username.toLowerCase().trim();

  // Try to return existing analysis from DB instead of crashing
  try {
    const submissions = await dbService.getAllUserSubmissions(sanitizedUsername);
    if (submissions && submissions.length > 0) {
      const analyzed = submissions.filter(s => s.analysis?.lastAnalyzedAt);
      return res.json({
        status: 'success',
        source: 'db',
        deprecated: true,
        message: 'This endpoint is deprecated. Analysis runs automatically during /extract.',
        submissions: analyzed.map(s => ({
          title: s.title,
          titleSlug: s.titleSlug,
          difficulty: s.difficulty,
          analysis: s.analysis
        })),
        totalAnalyzed: analyzed.length,
        totalSubmissions: submissions.length
      });
    }

    return res.json({
      status: 'success',
      deprecated: true,
      message: 'No analysis found. Extract data first via /extract — LLM analysis runs automatically.',
      submissions: [],
      totalAnalyzed: 0
    });
  } catch (error) {
    console.error('[CodeAnalysis] Error:', error.message);
    res.status(500).json({ error: 'Analysis lookup failed', message: error.message });
  }
});

/**
 * GET /code-analysis/:userId
 * DEPRECATED — Returns analysis from DB submissions instead of old cache
 */
app.get('/code-analysis/:userId', validateUserId, async (req, res) => {
  console.warn('[DEPRECATED] GET /code-analysis/:userId called — use /load-user-data/:userId instead.');

  try {
    const submissions = await dbService.getAllUserSubmissions(req.userId);
    const analyzed = (submissions || []).filter(s => s.analysis?.lastAnalyzedAt);

    if (analyzed.length === 0) {
      return res.status(404).json({
        status: 'not_found',
        message: 'No analysis found. Extract data via /extract — analysis runs automatically.'
      });
    }

    res.json({
      status: 'success',
      source: 'db',
      deprecated: true,
      submissions: analyzed.map(s => ({
        title: s.title,
        titleSlug: s.titleSlug,
        difficulty: s.difficulty,
        analysis: s.analysis
      })),
      totalAnalyzed: analyzed.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analysis', message: error.message });
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
app.get('/agent-state/:userId', validateUserId, async (req, res) => {
  // Fix 1: Disable caching for agent state
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });

  console.log(`[Agent State] Fetching state for user: ${req.userId}`);

  // Fix 3: Fetch status from memory to see if we are currently processing
  const memoryState = memory.getState(req.userId);
  const isProcessing = memoryState?.status === 'processing';

  // Fix 6: ENSURE DB IS USED (NOT MEMORY)
  const userData = await dbService.loadUserData(req.userId);

  // Fix 7: Debug Logging
  console.log(`[AgentState] Returning fresh data for ${req.userId}. Processing: ${isProcessing}`);

  if (!userData || (!userData.hasData && !isProcessing)) {
    console.log(`[Agent State] No data found for user: ${req.userId}`);
    return res.status(200).json({
      status: 'no_data',
      message: 'No submissions data found. Please use the Chrome extension to extract your LeetCode data.',
      user_id: req.userId
    });
  }

  // STEP 1: Version = numeric timestamp from latest AgentOutput.updatedAt
  const agentUpdatedAt = userData.agentOutput?.updatedAt;
  const version = agentUpdatedAt ? new Date(agentUpdatedAt).getTime() : Date.now();

  // Fix 4: MODIFY /agent-state RESPONSE
  res.status(200).json({
    status: isProcessing ? 'processing' : 'ready',
    user_id: req.userId,
    submissions_count: userData.submissionDocs?.length || 0,
    agentOutput: userData.agentOutput || null,
    // Add raw submissions for CodeAnalysis page to maintain backwards compatibility
    submissions: userData.submissionDocs?.flatMap(doc => doc.submissions) || [],
    version, // Numeric timestamp for staleness check
    lastUpdated: agentUpdatedAt || new Date().toISOString()
  });
});

// ============================================
// PROGRESS HISTORY ROUTE
// ============================================

/**
 * GET /progress-history/:userId
 * Returns last 10 progress snapshots + improvement trend
 * Used for historical charts and progress tracking
 */
app.get('/progress-history/:userId', validateUserId, async (req, res) => {
  try {
    const snapshots = await dbService.getProgressHistory(req.userId, 10);
    const trend = await dbService.getImprovementTrend(req.userId);

    res.json({
      status: 'ok',
      userId: req.userId,
      snapshots: snapshots || [],
      trend: trend || { trend: 'insufficient_data' },
      count: snapshots?.length || 0
    });
  } catch (err) {
    console.error('[ProgressHistory] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch progress history' });
  }
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
// AUTHENTICATION ROUTES
// ============================================

/**
 * POST /signup
 * Create new user account with email and password
 */
app.post('/signup', async (req, res) => {
  const { email, password, leetcodeUsername } = req.body || {};

  console.log(`[Auth] Signup attempt for: ${email}`);

  const result = await authService.signup(email, password, leetcodeUsername);

  if (!result.success) {
    return res.status(400).json({
      error: 'Signup failed',
      message: result.error
    });
  }

  console.log(`[Auth] User created: ${result.user.userId}`);

  res.status(201).json({
    status: 'success',
    message: 'Account created successfully',
    user: result.user,
    token: result.token
  });
});

/**
 * POST /login
 * Authenticate user with email and password
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  console.log(`[Auth] Login attempt for: ${email}`);

  const result = await authService.login(email, password);

  if (!result.success) {
    return res.status(401).json({
      error: 'Login failed',
      message: result.error
    });
  }

  console.log(`[Auth] User logged in: ${result.user.userId}`);

  res.json({
    status: 'success',
    message: 'Login successful',
    user: result.user,
    token: result.token
  });
});

/**
 * POST /guest-login
 * Login/register as guest using LeetCode username
 * Maintains backward compatibility - does not require password
 */
app.post('/guest-login', async (req, res) => {
  const { leetcodeUsername, username } = req.body || {};
  const targetUsername = leetcodeUsername || username;

  if (!targetUsername) {
    return res.status(400).json({
      error: 'Missing username',
      message: 'LeetCode username is required'
    });
  }

  const result = await authService.guestLogin(targetUsername);

  res.json({
    status: 'success',
    message: 'Guest access granted',
    user: result.user,
    token: result.token,
    dbConnected: result.dbConnected !== false
  });
});

/**
 * GET /me
 * Get current user info from token
 */
app.get('/me', authService.authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Please login to access this resource'
    });
  }

  const user = await dbService.findUserById(req.user.userId);

  if (!user) {
    return res.json({
      user: req.user,
      source: 'token'
    });
  }

  res.json({
    user: {
      userId: user.userId,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername,
      authType: user.authType,
      preferences: user.preferences,
      stats: user.stats,
      lastActive: user.lastActive
    },
    source: 'database'
  });
});

/**
 * GET /check-user/:leetcodeUsername
 * Check if a user exists by LeetCode username and if they have data
 */
app.get('/check-user/:leetcodeUsername', async (req, res) => {
  const { leetcodeUsername } = req.params;

  if (!leetcodeUsername || typeof leetcodeUsername !== 'string') {
    return res.status(400).json({
      error: 'Invalid username',
      message: 'LeetCode username is required'
    });
  }

  const result = await dbService.checkUserExists(leetcodeUsername);

  res.json(result || { exists: false });
});

/**
 * GET /load-user-data/:userId
 * Load complete user data for returning users (dashboard population)
 * 
 * CRITICAL: Also hydrates the in-memory store so /agent-state returns data
 */
app.get('/load-user-data/:userId', validateUserId, async (req, res) => {
  const userData = await dbService.loadUserData(req.userId);

  if (!userData) {
    return res.status(404).json({
      error: 'User not found',
      message: 'No data found for this user'
    });
  }

  if (userData.isProcessing) {
    return res.json({
      status: 'processing',
      message: 'Analysis in progress'
    });
  }

  if (!userData.hasData) {
    return res.json({
      user_id: req.userId,
      hasData: false,
      message: 'User exists but has no session data. Please extract data from LeetCode.'
    });
  }

  // ============================================
  // HYDRATE IN-MEMORY STORE FROM DB
  // DB is source of truth - cache is populated from DB
  // This ensures /agent-state/:userId returns 'ready' status
  // ============================================
  try {
    console.log(`[Cache] Hydrating memory store for: ${req.userId}`);

    // 1. Load submissions from DB and flatten for memory store
    const submissionDocs = userData.submissionDocs || await dbService.getAllUserSubmissions(req.userId);
    if (submissionDocs && submissionDocs.length > 0) {
      // Flatten: each submission entry becomes a top-level item (matching extract format)
      const flatSubmissions = [];
      for (const doc of submissionDocs) {
        for (const sub of (doc.submissions || [])) {
          flatSubmissions.push({
            id: doc.problemId || doc.titleSlug,
            title: doc.title,
            titleSlug: doc.titleSlug,
            status: sub.status,
            statusDisplay: sub.statusDisplay || sub.status,
            lang: sub.language,
            language: sub.language,
            code: sub.code,
            runtime: sub.runtime,
            memory: sub.memory,
            timestamp: sub.timestamp ? Math.floor(new Date(sub.timestamp).getTime() / 1000) : null,
            difficulty: doc.difficulty,
            topicTags: doc.topicTags || doc.topics || []
          });
        }
      }

      if (flatSubmissions.length > 0) {
        memory.addSubmissions(req.userId, flatSubmissions);
        console.log(`[Cache] Loaded ${flatSubmissions.length} submissions into memory`);
      }
    } else if (userData.submissions && userData.submissions.length > 0) {
      // Fallback: use raw session submissions
      memory.addSubmissions(req.userId, userData.submissions);
      console.log(`[Cache] Loaded ${userData.submissions.length} session submissions into memory`);
    }

    // 2. Hydrate agent outputs (if available)
    const agentOutput = userData.agentOutput;
    if (agentOutput) {
      if (agentOutput.diagnosis) {
        memory.storeDiagnosis(req.userId, agentOutput.diagnosis);
      }
      if (agentOutput.goals && agentOutput.goals.length > 0) {
        memory.storeGoals(req.userId, agentOutput.goals);
      }
      if (agentOutput.plan) {
        memory.storePlan(req.userId, agentOutput.plan);
      }
      if (agentOutput.monitoring) {
        memory.storeProgress(req.userId, agentOutput.monitoring);
      }
      if (agentOutput.adaptation) {
        memory.storeAdaptation(req.userId, agentOutput.adaptation);
      }
    }

    // 3. Also hydrate goals from goals collection if agentOutput doesn't have them
    if (userData.goals && userData.goals.length > 0 && !agentOutput?.goals?.length) {
      memory.storeGoals(req.userId, userData.goals);
      console.log(`[Cache] Loaded ${userData.goals.length} goals from goals collection`);
    }

    // 4. Mark agent loop as complete so /agent-state returns 'ready'
    memory.updateAgentStage(req.userId, 'complete');

    console.log(`[Cache] ✓ Memory store hydrated for: ${req.userId}`);
  } catch (hydrateErr) {
    // Non-blocking: if hydration fails, still return the API response
    console.error('[Cache] Hydration failed (non-blocking):', hydrateErr.message);
  }

  // FIX: Return COMPLETE agentOutput from DB — no filtering
  // DB is the single source of truth
  const formattedData = {
    user_id: req.userId,
    hasData: userData.hasData, // Based on submissions count from DB
    session: {
      sessionId: userData.session?.sessionId,
      timestamp: userData.session?.createdAt,
      summaryStats: userData.session?.summaryStats
    },
    // FIX: Return COMPLETE agent output — do NOT filter fields
    agentOutput: userData.agentOutput || null,
    activeGoals: userData.goals || [],
    progressHistory: userData.progressHistory || [],
    pendingActions: userData.pendingActions || [],
    // Include submissions with analysis from submissions collection
    submissionDocs: userData.submissionDocs || [],
    source: 'database'
  };

  console.log(`[DB] Returning user data:`, {
    hasData: formattedData.hasData,
    submissions: formattedData.submissionDocs.length,
    goalsInAgentOutput: formattedData.agentOutput?.goals?.length || 0,
    planDays: formattedData.agentOutput?.plan?.plan?.length || 0,
    recommendations: formattedData.agentOutput?.recommendations?.length || 0,
    hasNextAction: !!formattedData.agentOutput?.next_action
  });
  res.json(formattedData);
});

// ============================================
// HISTORY & ANALYTICS ROUTES (MongoDB)
// ============================================

/**
 * GET /sessions/:userId
 * Get user's session history
 */
app.get('/sessions/:userId', validateUserId, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const sessions = await dbService.getRecentSessions(req.userId, limit);

  res.json({
    user_id: req.userId,
    sessions: sessions || [],
    count: sessions?.length || 0,
    source: sessions ? 'database' : 'unavailable'
  });
});

/**
 * GET /submission-history/:userId/:problemId
 * Get submission history for a specific problem
 */
app.get('/submission-history/:userId/:problemId', validateUserId, async (req, res) => {
  const { problemId } = req.params;
  const history = await dbService.getSubmissionHistory(req.userId, problemId);

  if (!history) {
    return res.status(404).json({
      error: 'Not found',
      message: 'No submission history found for this problem'
    });
  }

  res.json({
    user_id: req.userId,
    problem_id: problemId,
    history
  });
});

/**
 * GET /user-stats/:userId
 * Get user's overall submission statistics from MongoDB
 */
app.get('/user-stats/:userId', validateUserId, async (req, res) => {
  const stats = await dbService.getUserSubmissionStats(req.userId);

  res.json({
    user_id: req.userId,
    stats: stats || null,
    source: stats ? 'database' : 'unavailable'
  });
});

/**
 * GET /progress-history/:userId
 * Get user's progress snapshots over time
 */
app.get('/progress-history/:userId', validateUserId, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 30;
  const history = await dbService.getProgressHistory(req.userId, limit);
  const trend = await dbService.getImprovementTrend(req.userId);

  res.json({
    user_id: req.userId,
    history: history || [],
    trend: trend || null,
    source: history ? 'database' : 'unavailable'
  });
});

/**
 * GET /active-goals/:userId
 * Get user's active goals from MongoDB
 */
app.get('/active-goals/:userId', validateUserId, async (req, res) => {
  const goals = await dbService.getActiveGoals(req.userId);

  res.json({
    user_id: req.userId,
    goals: goals || [],
    count: goals?.length || 0,
    source: goals ? 'database' : 'unavailable'
  });
});

/**
 * GET /pending-actions/:userId
 * Get user's pending recommended actions
 */
app.get('/pending-actions/:userId', validateUserId, async (req, res) => {
  const actions = await dbService.getPendingActions(req.userId);

  res.json({
    user_id: req.userId,
    actions: actions || [],
    count: actions?.length || 0,
    source: actions ? 'database' : 'unavailable'
  });
});

/**
 * POST /complete-action/:actionId
 * Mark an action as completed
 */
app.post('/complete-action/:actionId', async (req, res) => {
  const { actionId } = req.params;
  const { completedProblems } = req.body || {};

  const result = await dbService.completeAction(actionId, completedProblems || []);

  if (!result) {
    return res.status(404).json({
      error: 'Not found',
      message: 'Action not found or already completed'
    });
  }

  res.json({
    status: 'success',
    action: result
  });
});

// ============================================
// SYSTEM ROUTES
// ============================================

// ============================================
// PROBLEM METADATA ENDPOINT
// ============================================

app.get('/problem-details/:titleSlug', async (req, res) => {
  const { titleSlug } = req.params;
  if (!titleSlug) {
    return res.status(400).json({ error: 'titleSlug is required' });
  }

  try {
    const problem = await problemService.getProblemWithCache(titleSlug);
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found', titleSlug });
    }
    res.json(problem);
  } catch (error) {
    console.error('[ProblemDetails] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch problem details' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'DebugMind AI - Agentic Learning System',
    version: '2.2.0',
    features: [
      'Agent Decision Logging',
      'Confidence Tracking',
      'Strategy Evolution',
      'Smart Alerts',
      'Next Action Recommendations',
      'MongoDB Persistence',
      'User Authentication',
      'Session History',
      'Progress Tracking'
    ],
    agents: ['diagnosis', 'goal', 'planning', 'monitoring', 'adaptation'],
    database: {
      enabled: dbService.isDBConnected(),
      type: 'MongoDB'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api-docs', (req, res) => {
  res.json({
    version: '2.2.0',
    endpoints: {
      core: [
        { method: 'POST', path: '/extract', description: 'Extract submissions and run agent loop' },
        { method: 'POST', path: '/analyze', description: 'Get analysis dashboard data' },
        { method: 'POST', path: '/code-analysis', description: 'Deep AI analysis of submissions using Gemini' },
        { method: 'GET', path: '/code-analysis/:userId', description: 'Get cached code analysis' }
      ],
      auth: [
        { method: 'POST', path: '/signup', description: 'Create new user account' },
        { method: 'POST', path: '/login', description: 'Login with email/password' },
        { method: 'POST', path: '/guest-login', description: 'Guest login with LeetCode username' },
        { method: 'GET', path: '/me', description: 'Get current user info from token' }
      ],
      state: [
        { method: 'GET', path: '/agent-state/:userId', description: 'Get full agent state' },
        { method: 'POST', path: '/update-progress', description: 'Submit new data for incremental update' }
      ],
      history: [
        { method: 'GET', path: '/sessions/:userId', description: 'Get session history' },
        { method: 'GET', path: '/submission-history/:userId/:problemId', description: 'Get problem submission history' },
        { method: 'GET', path: '/user-stats/:userId', description: 'Get overall submission statistics' },
        { method: 'GET', path: '/progress-history/:userId', description: 'Get progress snapshots over time' },
        { method: 'GET', path: '/active-goals/:userId', description: 'Get active learning goals' },
        { method: 'GET', path: '/pending-actions/:userId', description: 'Get pending recommended actions' },
        { method: 'POST', path: '/complete-action/:actionId', description: 'Mark action as completed' }
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
    },
    database: {
      status: dbService.isDBConnected() ? 'connected' : 'disconnected'
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
// LAZY LLM ANALYSIS ENDPOINT
// ============================================

/**
 * POST /analyze-problem
 * Analyze multiple submissions of the same problem (comparative analysis)
 * Called when user clicks on a grouped problem
 */
app.post('/analyze-problem', async (req, res) => {
  console.warn('[DEPRECATED] POST /analyze-problem - LLM analysis now runs automatically during /extract. This endpoint will be removed in a future version.');
  try {
    const { submissions, problem } = req.body;

    // Support both new multi-submission format and legacy single-problem format
    const submissionList = submissions || (problem ? [problem] : null);

    if (!submissionList || submissionList.length === 0) {
      return res.status(400).json({
        error: 'Submissions data required',
        message: 'Please provide submissions array in the request body'
      });
    }

    const problemTitle = submissionList[0]?.title || 'Unknown Problem';
    const isMultiSubmission = submissionList.length > 1;

    console.log(`[AnalyzeProblem] Analyzing: ${problemTitle} (${submissionList.length} submission${submissionList.length > 1 ? 's' : ''})`);

    // ============================================
    // HYBRID ANALYSIS: Compute stats locally first (FAST)
    // ============================================
    const normalizeStatus = (status) => {
      if (!status) return 'Other';
      const s = status.toLowerCase();
      if (s.includes('accepted') || s === 'ac') return 'Accepted';
      if (s.includes('wrong')) return 'Wrong Answer';
      if (s.includes('time limit') || s === 'tle') return 'TLE';
      if (s.includes('runtime')) return 'Runtime Error';
      return 'Other';
    };

    const statuses = submissionList.map(s => normalizeStatus(s.status || s.statusDisplay));
    const acceptedCount = statuses.filter(s => s === 'Accepted').length;
    const wrongCount = statuses.filter(s => s === 'Wrong Answer').length;
    const tleCount = statuses.filter(s => s === 'TLE').length;
    const languages = [...new Set(submissionList.map(s => s.lang || s.language || 'Unknown'))];

    // Compute trend locally
    let trend = 'Struggling';
    const lastAccepted = statuses[statuses.length - 1] === 'Accepted';
    const firstAccepted = statuses[0] === 'Accepted';

    if (acceptedCount === submissionList.length) {
      trend = 'Mastered';
    } else if (lastAccepted && !firstAccepted) {
      trend = 'Improving';
    } else if (acceptedCount > 0) {
      trend = 'Mixed Progress';
    } else if (tleCount > 0) {
      trend = 'Efficiency Issues';
    }

    // Build progression string (e.g., "Wrong → Wrong → Accepted")
    const progressionStr = statuses.join(' → ');

    let prompt;

    if (isMultiSubmission) {
      // ============================================
      // LIGHTWEIGHT PROMPT - NO CODE (Fast LLM response)
      // ============================================
      prompt = `You are a coding mentor. Analyze this learning journey briefly.

Problem: "${problemTitle}"
Attempts: ${submissionList.length}
Progression: ${progressionStr}
Languages: ${languages.join(', ')}
Stats: ${acceptedCount} Accepted, ${wrongCount} Wrong, ${tleCount} TLE
Trend: ${trend}

Based on this progression pattern, provide:

1. **Progression**: "${progressionStr}"
2. **What Changed**: 2 likely improvements made (infer from pattern)
3. **Key Change**: Single most impactful fix (one sentence)
4. **Struggles**: 2 concepts user likely struggled with
5. **Confidence Gaps**: 2 weak areas based on failures
6. **Mistake Pattern**: Common mistake pattern for this problem type
7. **Learning Insight**: Key takeaway (one sentence)
8. **Next Practice**: 2 specific topics to practice next
9. **Score**: ${lastAccepted ? '8' : acceptedCount > 0 ? '6' : '4'}/10
10. **Time Complexity**: Just the Big-O notation (e.g., O(n), O(n log n))
11. **Space Complexity**: Just the Big-O notation (e.g., O(1), O(n))
12. **Optimal Approach**: 2-3 sentence description of the best approach

Be concise. Each point should be 1-2 lines max.`;
    } else {
      // SINGLE SUBMISSION - Also lightweight
      const sub = submissionList[0];
      const status = normalizeStatus(sub.status || sub.statusDisplay);
      const language = sub.lang || sub.language || 'Python';

      prompt = `You are a coding mentor. Brief analysis:

Problem: "${problemTitle}"
Status: ${status}
Language: ${language}

Provide:
1. **Verdict**: One-line assessment
2. **Score**: ${status === 'Accepted' ? '8' : '5'}/10
3. **Time Complexity**: Typical for this problem (just Big-O, e.g., O(n))
4. **Space Complexity**: Typical for this problem (just Big-O, e.g., O(1))
5. **What's Wrong**: ${status === 'Accepted' ? 'None - solution accepted' : '2 likely issues'}
6. **Improvements**: 2 suggestions
7. **Key Insight**: Main learning point
8. **Optimal Approach**: 1-2 sentence description of the best approach

Be concise.`;
    }

    // ============================================
    // LLM CALL WITH TIMEOUT SAFETY
    // ============================================
    let llmResult;
    try {
      llmResult = await llmService.generateLLMInsights(prompt);
    } catch (llmError) {
      console.error('[AnalyzeProblem] LLM timeout/error:', llmError.message);
      // Return local analysis as fallback
      return res.json({
        success: true,
        analysis: generateLocalFallbackAnalysis(problemTitle, statuses, trend, acceptedCount, wrongCount),
        source: 'local-fallback',
        problemTitle,
        submissionCount: submissionList.length,
        isComparative: isMultiSubmission,
        fallback: true
      });
    }

    if (llmResult.success && llmResult.text) {
      console.log(`[AnalyzeProblem] LLM analysis successful for: ${problemTitle}`);
      return res.json({
        success: true,
        analysis: llmResult.text,
        source: 'llm',
        problemTitle: problemTitle,
        submissionCount: submissionList.length,
        isComparative: isMultiSubmission,
        submissions: submissionList.map(s => ({
          status: s.status || s.statusDisplay,
          lang: s.lang || s.language
        }))
      });
    }

    // Fallback if LLM fails
    console.log(`[AnalyzeProblem] LLM failed, using fallback: ${llmResult.error}`);
    return res.json({
      success: false,
      analysis: generateFallbackAnalysis(submissionList[0], submissionList.length),
      source: 'rule-based',
      problemTitle: problemTitle,
      submissionCount: submissionList.length,
      isComparative: isMultiSubmission
    });

  } catch (error) {
    console.error('[AnalyzeProblem] Error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message || 'Server error during analysis'
    });
  }
});

// ============================================
// GENERATE OPTIMAL SOLUTION ENDPOINT
// ============================================
app.post('/generate-solution', async (req, res) => {
  console.log('[GenerateSolution] Endpoint hit');
  try {
    const { submissions, problemTitle } = req.body;
    console.log('[GenerateSolution] Request:', { problemTitle, submissionCount: submissions?.length });

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: 'No submissions provided' });
    }

    // Get the latest submission's code
    const latest = submissions[submissions.length - 1];
    const codeSnippet = (latest.code || '').slice(0, 1500);
    const language = latest.lang || latest.language || 'Python';
    const title = problemTitle || latest.title || 'Problem';
    const titleSlug = latest.titleSlug || title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Fetch problem context for accurate solution
    let problemSection = '';
    try {
      const problem = await problemService.getProblemWithCache(titleSlug);
      if (problem) {
        const parts = [];
        if (problem.shortDescription) parts.push(`Description: ${problem.shortDescription}`);
        if (problem.examples) parts.push(`Examples:\n${problem.examples.slice(0, 300)}`);
        if (problem.constraints) parts.push(`Constraints: ${problem.constraints.slice(0, 200)}`);
        problemSection = parts.join('\n\n');
        console.log(`[GenerateSolution] ✓ Problem context loaded for: ${titleSlug}`);
      }
    } catch (e) {
      console.log(`[GenerateSolution] No problem context for: ${titleSlug} (using title only)`);
    }

    // Build JSON-structured prompt for code generation
    const prompt = `You are an expert coding mentor.

Problem: "${title}"
Language: ${language}

${problemSection ? `${problemSection}\n\n` : ''}${codeSnippet ? `User's attempt:\n${codeSnippet}\n\n` : ''}Return ONLY valid JSON in this exact format:
{
  "optimal_solution": {
    "code": "<complete optimal solution code as a single string with \\n for newlines>",
    "time_complexity": "O(...)",
    "space_complexity": "O(...)",
    "explanation": "2-3 sentences explaining the approach"
  }
}

RULES:
- The "code" field must contain the COMPLETE solution function in ${language}
- Use \\n for newlines inside the code string
- Must be syntactically correct and include return statements
- No markdown, no backticks, no extra text outside the JSON
- Keep code clean and efficient (10-20 lines max)`;

    let llmResult;
    try {
      llmResult = await llmService.generateLLMInsights(prompt, {
        maxTokens: 1024,
        temperature: 0.3
      });
    } catch (llmError) {
      console.error('[GenerateSolution] LLM error:', llmError.message);
      return res.json({
        success: true,
        solution: null,
        explanation: 'Unable to generate solution. Please try again.',
        fallback: true
      });
    }

    if (!llmResult.success || !llmResult.text) {
      return res.json({
        success: true,
        solution: null,
        explanation: 'LLM response unavailable. Please try again.',
        fallback: true
      });
    }

    // --- ROBUST PARSING with multiple fallback strategies ---
    const rawText = llmResult.text;
    let solution = null;
    let explanation = '';
    let timeComplexity = '';
    let spaceComplexity = '';

    // Strategy 1: Parse as JSON (expected path with json_object mode)
    try {
      const parsed = JSON.parse(rawText);
      const sol = parsed.optimal_solution || parsed;
      solution = sol.code || sol.solution || null;
      explanation = sol.explanation || '';
      timeComplexity = sol.time_complexity || '';
      spaceComplexity = sol.space_complexity || '';
      console.log('[GenerateSolution] Parsed JSON successfully');
    } catch (e) {
      console.log('[GenerateSolution] JSON parse failed, trying fallbacks');
    }

    // Strategy 2: Extract code block from markdown (if LLM ignored json mode)
    if (!solution) {
      const codeMatch = rawText.match(/```[\w]*\n?([\s\S]*?)```/);
      if (codeMatch) {
        solution = codeMatch[1].trim();
        // Extract explanation from remaining text
        const afterCode = rawText.substring(rawText.indexOf(codeMatch[0]) + codeMatch[0].length);
        explanation = afterCode.replace(/\*\*/g, '').trim().substring(0, 500);
        console.log('[GenerateSolution] Extracted from code block');
      }
    }

    // Strategy 3: Look for function definition in raw text
    if (!solution) {
      const funcMatch = rawText.match(/((?:def |class |function |var |const |let |public )[\s\S]*)/);
      if (funcMatch) {
        solution = funcMatch[1].trim();
        console.log('[GenerateSolution] Extracted function from raw text');
      }
    }

    // --- CLEAN the code ---
    if (solution) {
      solution = solution
        .replace(/```[\w]*/g, '')   // Remove any remaining markdown code fences
        .replace(/```/g, '')
        .replace(/^[\s]*\n/, '')     // Remove leading blank lines
        .replace(/\n[\s]*$/, '')     // Remove trailing blank lines
        .trim();
    }

    // Build explanation string with complexity info
    const parts = [];
    if (timeComplexity) parts.push(`Time Complexity: ${timeComplexity}`);
    if (spaceComplexity) parts.push(`Space Complexity: ${spaceComplexity}`);
    if (explanation) parts.push(explanation);
    const fullExplanation = parts.join('. ').trim();

    res.json({
      success: true,
      solution,
      explanation: fullExplanation || null,
      language
    });

  } catch (error) {
    console.error('[GenerateSolution] Error:', error);
    res.status(500).json({
      error: 'Solution generation failed',
      message: error.message
    });
  }
});

/**
 * Generate fallback analysis when LLM is unavailable
 */
function generateFallbackAnalysis(problem, totalSubmissions = 1) {
  const isAccepted = problem.status?.toLowerCase().includes('accepted') ||
    problem.statusDisplay?.toLowerCase().includes('accepted');

  const progressionNote = totalSubmissions > 1
    ? `\n**Attempts**: ${totalSubmissions} submissions for this problem`
    : '';

  return `## Analysis for ${problem.title || 'Problem'}
${progressionNote}
**Status**: ${problem.status || problem.statusDisplay || 'Unknown'}
**Language**: ${problem.lang || problem.language || 'Unknown'}

**Assessment**: ${isAccepted ? 'Solution accepted ✓' : 'Solution needs work'}

**Suggestions**:
- ${isAccepted ? 'Review for optimization opportunities' : 'Debug and fix failing test cases'}
- Consider edge cases
- Analyze time and space complexity

*Note: Full AI analysis unavailable. Enable LLM for detailed insights.*`;
}

/**
 * Generate local fallback analysis for multi-submission (no LLM)
 */
function generateLocalFallbackAnalysis(title, statuses, trend, acceptedCount, wrongCount) {
  const progressionStr = statuses.join(' → ');
  const lastStatus = statuses[statuses.length - 1];
  const isAccepted = lastStatus === 'Accepted';

  return `**Progression**: ${progressionStr}

**What Changed**: Based on your ${statuses.length} attempts, you ${isAccepted ? 'successfully solved the problem' : 'are still working on it'}.

**Key Change**: ${isAccepted ? 'Fixed the core logic issue' : 'Keep debugging edge cases'}

**Struggles**: 
- Logic flow and edge cases
- Problem-specific constraints

**Confidence Gaps**:
- ${wrongCount > 2 ? 'Pattern recognition for this problem type' : 'Minor edge case handling'}
- Algorithm selection

**Mistake Pattern**: ${wrongCount > 0 ? 'Common mistakes with boundary conditions' : 'Good problem-solving approach'}

**Learning Insight**: ${isAccepted ? 'Persistence paid off! Great job solving it.' : 'Keep trying - you\'re making progress.'}

**Next Practice**:
- Similar problems in the same category
- Problems with edge case focus

**Score**: ${isAccepted ? '8' : acceptedCount > 0 ? '6' : '4'}/10

**Time Complexity**: Analyze based on your approach
**Space Complexity**: Analyze based on your approach

*Note: Quick analysis generated locally. LLM analysis timed out.*`;
}

// ============================================
// SERVER START
// ============================================

app.listen(port, () => {
  console.log(`DebugMind AI - Agentic Learning System v2.1             
              Server: http://localhost:${port}`);
});
