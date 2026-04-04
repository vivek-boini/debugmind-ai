// Load environment variables first
import 'dotenv/config';

import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4000;

// Import agent system
import { orchestrator, memory, logger, codeAnalysisService, llmService } from './services/index.js';
import * as agents from './agents/index.js';

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
    
    // console code 
    // console.log('[Extract] Raw submissions:', JSON.stringify(submissions, null, 2));
    // Or just the code per submission:
    // submissions.forEach((sub, i) => {
    //   console.log(`\n--- Submission ${i + 1}: ${sub.title} (${sub.lang}) ---`);
    //   console.log(sub.code);
    // });
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
 * POST /code-analysis
 * Deep AI-powered analysis of LeetCode submissions using Gemini
 */
app.post('/code-analysis', async (req, res) => {
  const { username, submissions, forceRefresh } = req.body || {};

  if (!username) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Username is required'
    });
  }

  const sanitizedUsername = username.toLowerCase().trim();
  console.log(`[CodeAnalysis] Request for user: ${sanitizedUsername}`);

  try {
    // If no submissions provided, try to get from memory store
    let subsToAnalyze = submissions;
    if (!subsToAnalyze || subsToAnalyze.length === 0) {
      const state = memory.getState(sanitizedUsername);
      subsToAnalyze = state.submissions || [];
    }

    if (!subsToAnalyze || subsToAnalyze.length === 0) {
      // Check if we have cached results
      const cached = codeAnalysisService.getCached(sanitizedUsername);
      if (cached) {
        return res.json({
          status: 'success',
          source: 'cache',
          ...cached
        });
      }

      return res.status(400).json({
        error: 'No submissions',
        message: 'No submissions found to analyze. Extract data first.'
      });
    }

    // Analyze submissions (uses cache if available)
    const results = await codeAnalysisService.getOrAnalyze(
      sanitizedUsername,
      subsToAnalyze,
      forceRefresh === true
    );

    res.json({
      status: 'success',
      source: forceRefresh ? 'fresh' : 'analyzed',
      ...results
    });

  } catch (error) {
    console.error('[CodeAnalysis] Error:', error);
    
    // Return a helpful error message
    if (error.message.includes('NVIDIA_API_KEY')) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'NVIDIA API key is not configured. Set NVIDIA_API_KEY environment variable.'
      });
    }

    res.status(500).json({
      error: 'Analysis failed',
      message: error.message || 'Failed to analyze submissions'
    });
  }
});

/**
 * GET /code-analysis/:userId
 * Get cached code analysis for a user (no new API call)
 */
app.get('/code-analysis/:userId', validateUserId, (req, res) => {
  const cached = codeAnalysisService.getCached(req.userId);
  
  if (!cached) {
    return res.status(404).json({
      status: 'not_found',
      message: 'No analysis found. Run POST /code-analysis first.'
    });
  }

  res.json({
    status: 'success',
    source: 'cache',
    ...cached
  });
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
    submissions: state.submissions,  // Include raw submissions for CodeAnalysis page
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
        { method: 'POST', path: '/analyze', description: 'Get analysis dashboard data' },
        { method: 'POST', path: '/code-analysis', description: 'Deep AI analysis of submissions using Gemini' },
        { method: 'GET', path: '/code-analysis/:userId', description: 'Get cached code analysis' }
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
// LAZY LLM ANALYSIS ENDPOINT
// ============================================

/**
 * POST /analyze-problem
 * Analyze multiple submissions of the same problem (comparative analysis)
 * Called when user clicks on a grouped problem
 */
app.post('/analyze-problem', async (req, res) => {
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
    
    // Build focused prompt for code generation
    const prompt = `You are an expert coding mentor.

Problem: "${title}"
Language: ${language}

${codeSnippet ? `User's attempt:\n\`\`\`${language}\n${codeSnippet}\n\`\`\`` : ''}

Generate:
1. **Optimal Solution**: Clean, efficient code (10-15 lines max) in ${language}
2. **Time Complexity**: Big-O notation with brief explanation
3. **Space Complexity**: Big-O notation with brief explanation  
4. **Explanation**: 2-3 sentences explaining the approach

Format the code in a code block.`;

    let llmResult;
    try {
      llmResult = await llmService.generateLLMInsights(prompt);
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
    
    // Extract code block from response
    const text = llmResult.text;
    const codeMatch = text.match(/```[\w]*\n?([\s\S]*?)```/);
    const solution = codeMatch ? codeMatch[1].trim() : null;
    
    // Extract explanation (everything after code block or full text if no code)
    let explanation = '';
    if (codeMatch) {
      const afterCode = text.substring(text.indexOf(codeMatch[0]) + codeMatch[0].length);
      explanation = afterCode.trim().substring(0, 500);
    } else {
      explanation = text.substring(0, 500);
    }
    
    res.json({
      success: true,
      solution,
      explanation,
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
