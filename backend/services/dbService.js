/**
 * Database Service
 * Non-blocking MongoDB operations for background persistence
 * 
 * IMPORTANT: All operations are designed to NOT block the main request flow
 * If MongoDB is unavailable, operations fail silently and log errors
 */

import {
  connectDB,
  isDBConnected,
  User,
  Session,
  Submission,
  AgentOutput,
  Goal,
  ProgressSnapshot,
  Action,
  Problem
} from './mongoModels.js';
import crypto from 'crypto';

// Track initialization
let initialized = false;

/**
 * Initialize database connection
 * Called once at startup
 */
async function initialize() {
  if (initialized) return isDBConnected();
  
  try {
    const connected = await connectDB();
    initialized = true;
    return connected;
  } catch (error) {
    console.error('[DBService] Initialization failed:', error.message);
    initialized = true; // Mark as initialized to prevent retry loops
    return false;
  }
}

/**
 * Safe wrapper for DB operations
 * Returns null on failure, never throws
 */
async function safeOperation(operation, operationName) {
  if (!isDBConnected()) {
    console.warn(`[DBService] ${operationName}: Database not connected, skipping`);
    return null;
  }

  try {
    return await operation();
  } catch (error) {
    console.error(`[DBService] ${operationName} failed:`, error.message);
    return null;
  }
}

/**
 * Background operation wrapper
 * Runs operation in background without blocking
 */
function backgroundOperation(operation, operationName) {
  setImmediate(async () => {
    await safeOperation(operation, operationName);
  });
}

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * Create a new session from extract data
 * Returns session immediately, processing continues in background
 */
async function createSession(userId, submissions, metadata = {}) {
  return safeOperation(async () => {
    const session = await Session.createFromExtract(userId, submissions, metadata);
    console.log(`[DBService] Session created: ${session.sessionId} for user: ${userId}`);
    return session;
  }, 'createSession');
}

/**
 * Update session status
 */
async function updateSessionStatus(sessionId, status, error = null, duration = null) {
  return safeOperation(async () => {
    const update = { processingStatus: status };
    if (error) update.processingError = error;
    if (duration) update.processingDuration = duration;
    
    return Session.findOneAndUpdate(
      { sessionId },
      update,
      { new: true }
    );
  }, 'updateSessionStatus');
}

/**
 * Link agent output to session
 */
async function linkAgentOutputToSession(sessionId, agentOutputId) {
  return safeOperation(async () => {
    return Session.findOneAndUpdate(
      { sessionId },
      { agentOutputId, processingStatus: 'completed' },
      { new: true }
    );
  }, 'linkAgentOutputToSession');
}

/**
 * Get user's recent sessions
 */
async function getRecentSessions(userId, limit = 10) {
  return safeOperation(async () => {
    return Session.find({ userId: userId.toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-rawExtractedData.submissions.code')
      .lean();
  }, 'getRecentSessions');
}

// ============================================
// USER OPERATIONS
// ============================================

/**
 * Find or create a guest user
 */
async function findOrCreateUser(leetcodeUsername) {
  return safeOperation(async () => {
    return User.findOrCreateGuest(leetcodeUsername);
  }, 'findOrCreateUser');
}

/**
 * Update user stats after session
 */
async function updateUserStats(userId, sessionStats) {
  return safeOperation(async () => {
    const user = await User.findOne({ userId: userId.toLowerCase() });
    if (!user) return;

    user.stats.totalSessions++;
    user.stats.totalSubmissions += sessionStats.totalSubmissions || 0;
    user.lastActive = new Date();
    
    // Update streak
    const today = new Date().toDateString();
    const lastSession = user.stats.lastSessionDate?.toDateString();
    
    if (lastSession !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastSession === yesterday) {
        user.stats.currentStreak++;
      } else if (lastSession !== today) {
        user.stats.currentStreak = 1;
      }
      user.stats.longestStreak = Math.max(user.stats.longestStreak, user.stats.currentStreak);
    }
    
    user.stats.lastSessionDate = new Date();
    await user.save();
  }, 'updateUserStats');
}

/**
 * Create user with email/password
 */
async function createAuthenticatedUser(email, password, leetcodeUsername) {
  return safeOperation(async () => {
    const userId = leetcodeUsername.toLowerCase().trim();
    
    // Check if user already exists
    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { userId }
      ]
    });
    
    if (existing) {
      throw new Error('User with this email or username already exists');
    }
    
    return User.create({
      userId,
      email: email.toLowerCase(),
      password,
      leetcodeUsername: userId,
      authType: 'password'
    });
  }, 'createAuthenticatedUser');
}

/**
 * Find user by email for login
 */
async function findUserByEmail(email) {
  return safeOperation(async () => {
    return User.findOne({ email: email.toLowerCase() }).select('+password');
  }, 'findUserByEmail');
}

/**
 * Find user by ID
 */
async function findUserById(userId) {
  return safeOperation(async () => {
    return User.findOne({ userId: userId.toLowerCase() });
  }, 'findUserById');
}

// ============================================
// SUBMISSION OPERATIONS
// ============================================

/**
 * Store submissions in background
 * Groups by problem and updates stats
 */
function storeSubmissionsBackground(userId, submissions, sessionId) {
  backgroundOperation(async () => {
    console.log(`[DBService] Storing ${submissions.length} submissions for ${userId}`);
    const results = await Submission.bulkAddSubmissions(userId, submissions, sessionId);
    const successful = results.filter(r => r.success).length;
    console.log(`[DBService] Stored ${successful}/${submissions.length} submissions`);
  }, 'storeSubmissionsBackground');
}

/**
 * Store submissions (AWAITABLE version)
 * Used by persistExtractData so LLM pipeline can find submissions in DB
 */
async function storeSubmissionsAwaited(userId, submissions, sessionId) {
  return safeOperation(async () => {
    // STEP 4: Enrich missing topics before saving to DB
    for (const sub of submissions) {
      if (!sub.topics || sub.topics.length === 0) {
        const titleSlug = sub.titleSlug || sub.title?.toLowerCase().replace(/\s+/g, '-');
        if (titleSlug) {
          const problem = await Problem.findOne({ titleSlug }).select('tags topicTags').lean();
          if (problem) {
            // STEP 7: Direct topic injection from Problem collection
            sub.topics = problem.tags || [];
            if (sub.topics.length === 0 && problem.topicTags) {
              sub.topics = problem.topicTags.map(t => t.name);
            }
            console.log(`[DBService] Injected topics for "${sub.title}":`, sub.topics);
          }
        }
      }
    }

    console.log(`[DBService] Storing ${submissions.length} submissions for ${userId} (awaited)`);
    
    // Fetch existing submissions for duplicate check
    const existingDocs = await Submission.find({ userId: userId.toLowerCase().trim() }).lean();
    const existingSubmissions = existingDocs.flatMap(doc => doc.submissions.map(s => ({ ...s, titleSlug: doc.titleSlug })));
    
    const uniqueSubmissions = [];
    let preFilterSkipped = 0;

    for (const submission of submissions) {
      const titleSlug = (submission.titleSlug || submission.title?.toLowerCase().replace(/\s+/g, '-') || '').toLowerCase().trim();
      
      // STEP 1 + 5: Always generate codeHash — never allow undefined
      const codeStr = submission.code || '';
      const hashInput = codeStr.length > 0
        ? codeStr
        : `${titleSlug}|${submission.timestamp || ''}|${submission.status || submission.statusDisplay || ''}`;
      const codeHash = crypto.createHash('sha256').update(hashInput).digest('hex');
      
      // Attach codeHash to submission for downstream use
      submission.codeHash = codeHash;

      console.log("[Insert Debug]", { title: submission.title, timestamp: submission.timestamp, codeHash });
      
      // STEP 2: STRONG DEDUP — check timestamp OR codeHash match
      const submissionTimestamp = submission.timestamp
        ? new Date(submission.timestamp * 1000)
        : new Date();

      const isDuplicate = existingSubmissions.some(s => {
        // 1. Same titleSlug + timestamp + status
        if (s.titleSlug === titleSlug &&
            s.status === submission.status &&
            s.timestamp?.getTime() === submissionTimestamp.getTime()) {
          return true;
        }
        // 2. Same titleSlug + codeHash
        if (s.titleSlug === titleSlug && s.codeHash && s.codeHash === codeHash) {
          return true;
        }
        return false;
      });

      if (isDuplicate) {
        preFilterSkipped++;
      } else {
        uniqueSubmissions.push(submission);
      }
    }

    // STEP 4: Clear dedup logging
    console.log(`[Dedup] Pre-filter skipped ${preFilterSkipped} duplicates for ${userId}`);

    const results = await Submission.bulkAddSubmissions(userId, uniqueSubmissions, sessionId);
    const successful = results.filter(r => r.success).length;
    const totalSkipped = preFilterSkipped + (results.skippedCount || 0);
    console.log(`[Dedup] Skipped ${totalSkipped} total duplicates for ${userId}`);
    console.log(`[Insert] Stored ${results.newCount || 0} new submissions (${successful}/${uniqueSubmissions.length} successful)`);
    
    // Debug: total in DB after insert
    const allDbSubmissions = await Submission.find({ userId: userId.toLowerCase().trim() }).lean();
    const totalCount = allDbSubmissions.reduce((acc, doc) => acc + (doc.submissions?.length || 0), 0);
    console.log("[DB] Total submissions after insert:", totalCount);
    
    return { total: submissions.length, successful, newCount: results.newCount || 0, results };
  }, 'storeSubmissionsAwaited');
}

/**
 * Fetch LAST agent output (Step 2)
 */
async function getPreviousAgentOutput(userId) {
  return safeOperation(async () => {
    return AgentOutput.findOne({ userId: userId.toLowerCase().trim(), status: 'completed' })
      .sort({ createdAt: -1 })
      .lean();
  }, 'getPreviousAgentOutput');
}

/**
 * Build stats from ALL submissions (Step 3)
 */
async function buildProgressStats(userId) {
  return safeOperation(async () => {
    const submissions = await Submission.find({ userId: userId.toLowerCase().trim() }).lean();
    
    // UI-friendly topic display names
    const UI_TOPIC_MAP = {
      'sliding-window': 'Sliding Window', 'dp': 'Dynamic Programming',
      'binary-search': 'Binary Search', 'two-pointers': 'Two Pointers',
      'arrays': 'Arrays & Hashing', 'linked-list': 'Linked List',
      'tree': 'Trees', 'binary-tree': 'Trees', 'graph': 'Graphs',
      'stack': 'Stack & Queue', 'queue': 'Stack & Queue',
      'backtracking': 'Backtracking', 'greedy': 'Greedy',
      'heap': 'Heap/Priority Queue', 'hash-table': 'Hash Table',
      'string': 'String', 'math': 'Math', 'sorting': 'Sorting',
      'bfs': 'BFS', 'dfs': 'DFS', 'recursion': 'Recursion',
      'bit-manipulation': 'Bit Manipulation', 'trie': 'Trie',
      'divide-and-conquer': 'Divide & Conquer', 'other': 'Other'
    };

    let totalAttempts = 0;
    let acceptedCount = 0;
    const topicStats = {};

    submissions.forEach(sub => {
      const attempts = sub.stats?.totalAttempts || 0;
      const isProblemSolved = sub.stats?.isSolved || false;
      
      totalAttempts += attempts;
      if (isProblemSolved) {
        acceptedCount += 1;
      }
      
      const topics = sub.topics || [];
      topics.forEach(rawT => {
        // Normalize to display name
        const t = UI_TOPIC_MAP[rawT] || rawT;
        if (!topicStats[t]) {
          topicStats[t] = { attempts: 0, total: 0, accepted: 0, problemsAttempted: 0, problemsSolved: 0 };
        }
        topicStats[t].attempts += attempts;
        topicStats[t].total += attempts;
        topicStats[t].problemsAttempted += 1;
        if (isProblemSolved) {
          topicStats[t].problemsSolved += 1;
          topicStats[t].accepted += 1;
        }
      });
    });

    const topicScores = {};
    const insufficientTopics = [];
    for (const [topic, stats] of Object.entries(topicStats)) {
      if (stats.attempts < 3) insufficientTopics.push(topic);
      topicScores[topic] = stats.problemsAttempted > 0 
        ? Number(((stats.problemsSolved / stats.problemsAttempted) * 100).toFixed(1))
        : 0;
    }

    const totalProblems = submissions.length;
    const successRate = totalProblems > 0 ? Math.round((acceptedCount / totalProblems) * 100) : 0;

    // Debug log
    console.log('[Topic Stats - DB]', topicScores);

    return {
      totalAttempts,
      solvedCount: acceptedCount,
      totalProblems,
      successRate,
      topicScores,
      topicStats, // Full stats for topic breakdown
      insufficientTopics
    };
  }, 'buildProgressStats');
}

/**
 * Get user's submission history for a problem (by titleSlug)
 */
async function getSubmissionHistory(userId, titleSlugOrProblemId) {
  return safeOperation(async () => {
    const normalizedUserId = userId.toLowerCase().trim();
    const normalizedSlug = titleSlugOrProblemId.toLowerCase().trim();
    
    // Try titleSlug first (new primary key), fall back to problemId for backward compat
    let doc = await Submission.findOne({
      userId: normalizedUserId,
      titleSlug: normalizedSlug
    }).lean();
    
    if (!doc) {
      doc = await Submission.findOne({
        userId: normalizedUserId,
        problemId: titleSlugOrProblemId
      }).lean();
    }
    
    return doc;
  }, 'getSubmissionHistory');
}

/**
 * Get ALL submission documents for a user
 * Used to hydrate in-memory store from DB
 */
async function getAllUserSubmissions(userId) {
  return safeOperation(async () => {
    return Submission.find({
      userId: userId.toLowerCase().trim()
    }).lean();
  }, 'getAllUserSubmissions');
}

/**
 * Get user's overall submission stats
 */
async function getUserSubmissionStats(userId) {
  return safeOperation(async () => {
    const stats = await Submission.getUserStats(userId);
    return stats[0] || null;
  }, 'getUserSubmissionStats');
}

/**
 * UPSERT analysis for a submission (Issue 2 fix)
 * Stores LLM analysis results: finalScore, timeComplexity, spaceComplexity, mistakes, improvements, patterns
 */
async function upsertSubmissionAnalysis(userId, titleSlug, analysisData) {
  return safeOperation(async () => {
    const result = await Submission.upsertAnalysis(userId, titleSlug, analysisData);
    return result;
  }, 'upsertSubmissionAnalysis');
}

// ============================================
// AGENT OUTPUT OPERATIONS
// ============================================

/**
 * Store agent loop results
 */
async function storeAgentOutput(userId, sessionId, loopResult) {
  return safeOperation(async () => {
    const output = await AgentOutput.createFromLoopResult(userId, sessionId, loopResult);
    console.log(`[DBService] Agent output stored for session: ${sessionId}`);
    return output;
  }, 'storeAgentOutput');
}

/**
 * Get latest agent output for user
 */
async function getLatestAgentOutput(userId) {
  return safeOperation(async () => {
    return AgentOutput.findOne({ userId: userId.toLowerCase() })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
  }, 'getLatestAgentOutput');
}

/**
 * Get agent output by session
 */
async function getAgentOutputBySession(sessionId) {
  return safeOperation(async () => {
    return AgentOutput.findOne({ sessionId }).lean();
  }, 'getAgentOutputBySession');
}

// ============================================
// GOAL OPERATIONS
// ============================================

/**
 * Store goals from agent
 */
function storeGoalsBackground(userId, sessionId, agentGoals) {
  backgroundOperation(async () => {
    const goals = await Goal.createFromAgentGoals(userId, sessionId, agentGoals);
    console.log(`[DBService] Stored ${goals.length} goals for ${userId}`);
  }, 'storeGoalsBackground');
}

/**
 * Get active goals for user
 */
async function getActiveGoals(userId) {
  return safeOperation(async () => {
    return Goal.find({
      userId: userId.toLowerCase(),
      status: 'active'
    }).sort({ priority: 1 }).lean();
  }, 'getActiveGoals');
}

/**
 * Update goal progress
 */
async function updateGoalProgress(goalId, currentValue) {
  return safeOperation(async () => {
    const goal = await Goal.findOne({ goalId });
    if (!goal) return null;
    
    goal.currentMetric = {
      value: currentValue,
      lastUpdated: new Date()
    };
    goal.progress.push({
      value: currentValue,
      timestamp: new Date()
    });
    
    // Check if goal is completed
    if (goal.targetMetric && currentValue >= goal.targetMetric.value) {
      goal.status = 'completed';
      goal.completedAt = new Date();
    }
    
    return goal.save();
  }, 'updateGoalProgress');
}

// ============================================
// PROGRESS SNAPSHOT OPERATIONS
// ============================================

/**
 * Create progress snapshot
 */
async function createProgressSnapshotBackground(userId, sessionId, diagnosis, submissions) {
  return safeOperation(async () => {
    const snapshot = await ProgressSnapshot.createSnapshot(userId, sessionId, diagnosis, submissions);
    console.log(`[DBService] Progress snapshot created for session: ${sessionId}`);
    return snapshot;
  }, 'createProgressSnapshotBackground');
}

/**
 * Get progress history
 */
async function getProgressHistory(userId, limit = 30) {
  return safeOperation(async () => {
    return ProgressSnapshot.find({ userId: userId.toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }, 'getProgressHistory');
}

/**
 * Get improvement trend
 */
async function getImprovementTrend(userId) {
  return safeOperation(async () => {
    const snapshots = await ProgressSnapshot.find({ userId: userId.toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('overallStats.successRate createdAt')
      .lean();
    
    const count = snapshots.length;

    // Step 1: Handle insufficient data
    if (count <= 1) {
      return {
        trend: 'insufficient_data',
        change: 0,
        confidence: 'low',
        dataPoints: count,
        history: []
      };
    }

    // Reverse to chronological order (oldest first)
    const chronological = [...snapshots].reverse();

    // Step 1: Use recent window (last N=5) for trend — reduces noise from old data
    const N = 5;
    const window = chronological.slice(-N);

    const first = window[0].overallStats?.successRate || 0;
    const last = window[window.length - 1].overallStats?.successRate || 0;
    let change = last - first;
    // Clamp to safe range
    change = Math.max(-100, Math.min(100, change));

    // Step 2: Stable threshold — ±2% is noise, not a real trend
    let trend;
    if (Math.abs(change) < 2) {
      trend = 'stable';
    } else if (change > 0) {
      trend = 'improving';
    } else {
      trend = 'declining';
    }

    // Step 3: Volatility — standard deviation of successive changes
    const diffs = window.map((s, i) => {
      if (i === 0) return 0;
      return (s.overallStats?.successRate || 0) -
             (window[i - 1].overallStats?.successRate || 0);
    }).slice(1);

    const mean = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
    const variance = diffs.length > 0 ? diffs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / diffs.length : 0;
    const volatility = Math.sqrt(variance);

    // Step 4: Strength label
    let strength = 'weak';
    if (Math.abs(change) >= 2 && Math.abs(change) < 5) {
      strength = 'moderate';
    } else if (Math.abs(change) >= 5) {
      strength = 'strong';
    }

    // Confidence based on data points
    let confidence = 'low';
    if (count >= 3 && count <= 6) confidence = 'medium';
    if (count >= 7) confidence = 'high';

    // Lightweight history for charts (no full snapshot objects)
    const history = chronological.map(s => ({
      date: new Date(s.createdAt).toISOString().split('T')[0],
      successRate: s.overallStats?.successRate || 0
    }));

    const finalChange = Number(change.toFixed(2));
    const finalVolatility = Number(volatility.toFixed(2));

    // Normalized volatility (0 = perfectly stable, 1 = highly erratic)
    const volatilityScore = Number(Math.min(1, volatility / 20).toFixed(2));

    // Direction consistency — what % of session-to-session changes were positive
    const positiveDiffs = diffs.filter(d => d > 0).length;
    const directionConsistency = diffs.length > 0 ? Number((positiveDiffs / diffs.length).toFixed(2)) : 0;

    // Human-readable explanation
    const changeAbs = Math.abs(finalChange);
    const dir = finalChange >= 0 ? 'up' : 'down';
    let explanation;
    if (trend === 'stable') {
      explanation = `Your performance is stable (${finalChange >= 0 ? '+' : ''}${finalChange}%). ${confidence === 'high' ? 'This is a reliable reading.' : 'More sessions will improve accuracy.'}`;
    } else if (trend === 'improving') {
      explanation = `You're improving — ${dir} ${changeAbs}% over your last ${window.length} sessions. ${volatilityScore > 0.5 ? 'Progress is inconsistent — try to maintain a steady pace.' : 'Consistent progress — keep it up!'}`;
    } else if (trend === 'declining') {
      explanation = `Performance dipped ${changeAbs}% recently. ${directionConsistency < 0.3 ? 'Most sessions showed decline — consider revisiting weak topics.' : 'Some sessions were positive — the decline may be temporary.'}`;
    } else {
      explanation = 'Not enough data yet. Complete a few more sessions to see your trend.';
    }

    // Debug log
    console.log('[Trend Advanced]', { trend, change: finalChange, confidence, volatility: finalVolatility, strength, volatilityScore, directionConsistency });

    // Final response — all existing fields preserved + new extensions
    return {
      trend,
      change: finalChange,
      confidence,
      dataPoints: count,
      history,
      volatility: finalVolatility,
      strength,
      volatilityScore,
      directionConsistency,
      explanation
    };
  }, 'getImprovementTrend');
}

// ============================================
// ACTION OPERATIONS
// ============================================

/**
 * Store recommended action
 */
function storeActionBackground(userId, sessionId, nextAction) {
  backgroundOperation(async () => {
    const action = await Action.createFromNextAction(userId, sessionId, nextAction);
    if (action) {
      console.log(`[DBService] Action stored: ${action.actionType} for ${userId}`);
    }
  }, 'storeActionBackground');
}

/**
 * Get pending actions for user
 */
async function getPendingActions(userId) {
  return safeOperation(async () => {
    return Action.find({
      userId: userId.toLowerCase(),
      status: 'pending',
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    }).sort({ priority: 1, createdAt: -1 }).lean();
  }, 'getPendingActions');
}

/**
 * Mark action as completed
 */
async function completeAction(actionId, completedProblems = []) {
  return safeOperation(async () => {
    return Action.findByIdAndUpdate(
      actionId,
      {
        status: 'completed',
        completedAt: new Date(),
        completedProblems
      },
      { new: true }
    );
  }, 'completeAction');
}

// ============================================
// MAIN PERSISTENCE FUNCTION
// ============================================

/**
 * Persist all data from an extract request
 * Called after agent loop completes
 * All operations are non-blocking
 * DB is the source of truth - cache is updated after
 */
async function persistExtractData(userId, submissions, loopResult, sessionId) {
  if (!isDBConnected()) {
    console.warn('[DB] Database not connected, skipping persistence');
    return null;
  }

  // Fix 2: Guard — never overwrite valid data with empty agent output
  if (!loopResult || !loopResult.goals || loopResult.goals.length === 0) {
    console.log("[DB] Skipping empty agent output save — no goals produced");
    return null;
  }

  const startTime = Date.now();
  
  try {
    // Update session status to processing
    await updateSessionStatus(sessionId, 'processing');
    
    // Log what we're about to save (DEBUG)
    const recommendationsCount = loopResult.plan?.plan?.flatMap(day => day.items || day.problems || [])?.length || 0;
    console.log(`[DB] Persisting data for ${userId}:`, {
      hasDiagnosis: !!loopResult.diagnosis,
      goalsCount: loopResult.goals?.length || 0,
      hasPlan: !!loopResult.plan,
      planDays: loopResult.plan?.plan?.length || 0,
      recommendationsCount,
      hasMonitoring: !!loopResult.monitoring,
      hasAdaptation: !!loopResult.adaptation,
      hasNextAction: !!loopResult.next_action,
      submissionsCount: submissions?.length || 0
    });

    // STEP 6: Debug log for Progress Dashboard data
    console.log('[Progress Debug - Persist]', {
      metrics: loopResult.metrics,
      hasConfidenceHistory: !!loopResult.confidence_history,
      chartDataPoints: loopResult.confidence_history?.chart_data?.datasets?.[0]?.data?.length || 0,
      hasStrategyEvolution: !!loopResult.strategy_evolution
    });
    
    // Store agent output (awaited because we need the ID)
    const agentOutput = await storeAgentOutput(userId, sessionId, loopResult);
    if (agentOutput) {
      console.log(`[DB] ✓ Saved agentoutputs for session: ${sessionId}`);
    }
    
    // Link to session
    if (agentOutput) {
      await linkAgentOutputToSession(sessionId, agentOutput._id);
    }
    
    // Update session with analysis results
    await updateSessionAnalysis(sessionId, loopResult.diagnosis);
    if (loopResult.diagnosis) {
      console.log(`[DB] ✓ Saved analysis to session: ${sessionId}`);
    }
    
    // Submissions already stored in index.js before agent loop — DO NOT store again
    // await storeSubmissionsAwaited(userId, submissions, sessionId);
    // Progress snapshot can run in background (not needed by LLM)
    await createProgressSnapshotBackground(userId, sessionId, loopResult.diagnosis, submissions);
    
    // Store goals with logging
    if (loopResult.goals && loopResult.goals.length > 0) {
      await storeGoalsWithLogging(userId, sessionId, loopResult.goals);
    } else {
      console.warn(`[Agent] No goals to save for ${userId}`);
    }
    
    // Store actions with logging
    if (loopResult.next_action) {
      await storeActionWithLogging(userId, sessionId, loopResult.next_action);
    } else {
      console.warn(`[Agent] No next_action to save for ${userId}`);
    }
    
    // Update user stats and last session in background
    await updateUserStats(userId, {
      totalSubmissions: submissions.length,
      lastSessionId: sessionId
    });
    
    const duration = Date.now() - startTime;
    console.log(`[DB] ✓ Persistence complete in ${duration}ms for session: ${sessionId}`);
    console.log(`[Cache] ✓ Updated for user: ${userId}`);
    
    return {
      sessionId,
      agentOutputId: agentOutput?._id,
      persistenceStarted: true,
      goalsCount: loopResult.goals?.length || 0,
      hasActions: !!loopResult.next_action
    };
  } catch (error) {
    console.error('[DB] Persistence error:', error.message);
    await updateSessionStatus(sessionId, 'failed', error.message);
    return null;
  }
}

/**
 * Store goals with proper logging
 */
async function storeGoalsWithLogging(userId, sessionId, agentGoals) {
  return safeOperation(async () => {
    const goals = await Goal.createFromAgentGoals(userId, sessionId, agentGoals);
    console.log(`[Agent] ✓ Goals stored: ${goals.length} goals for ${userId}`);
  }, 'storeGoalsWithLogging');
}

/**
 * Store action with proper logging
 */
async function storeActionWithLogging(userId, sessionId, nextAction) {
  return safeOperation(async () => {
    const action = await Action.createFromNextAction(userId, sessionId, nextAction);
    if (action) {
      console.log(`[Agent] ✓ Actions stored: ${action.actionType} for ${userId}`);
    }
  }, 'storeActionWithLogging');
}

// ============================================
// RETURNING USER DATA LOADING
// ============================================

/**
 * Update session with analysis results
 */
async function updateSessionAnalysis(sessionId, diagnosis) {
  return safeOperation(async () => {
    const weakTopics = diagnosis?.weak_topics?.map(wt => wt.topic) || [];
    const strongTopics = []; // Could be computed from high-scoring topics
    
    return Session.findOneAndUpdate(
      { sessionId },
      {
        'analysisResults.weakTopics': weakTopics,
        'analysisResults.overallSuccessRate': diagnosis?.overall_success_rate,
        'analysisResults.confidenceLevel': diagnosis?.confidence_level,
        processingStatus: 'completed'
      },
      { new: true }
    );
  }, 'updateSessionAnalysis');
}

/**
 * Load complete user data for returning users
 * Returns everything needed to populate dashboard without re-extracting
 * Issue 5 fix: Fetch all collections properly
 */
async function loadUserData(userId) {
  return safeOperation(async () => {
    const normalizedUserId = userId.toLowerCase().trim();
    
    // Get user
    const user = await User.findOne({ userId: normalizedUserId }).lean();
    if (!user) return null;
    
    // Get latest completed session
    const latestSession = await Session.findOne({
      userId: normalizedUserId,
      processingStatus: 'completed'
    })
      .sort({ createdAt: -1 })
      .lean();
    
    // Fix 5: Prevent Empty UI Overwrite (RACE CONDITION)
    const activeProcessingSession = await Session.findOne({
      userId: normalizedUserId,
      processingStatus: 'processing'
    }).lean();

    if (!latestSession && activeProcessingSession) {
      return { user, hasData: true, isProcessing: true };
    }
    
    if (!latestSession) return { user, hasData: false };
    
    // Step 1: Fetch the LATEST VALID agent output (must have goals + plan + recommendations)
    let agentOutput = await AgentOutput.findOne({
      userId: normalizedUserId,
      goals: { $exists: true, $not: { $size: 0 } },
      plan: { $exists: true },
      recommendations: { $exists: true, $not: { $size: 0 } }
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    
    // Step 2: Fallback — if no fully valid doc, try the latest one anyway
    if (!agentOutput) {
      const fallback = await AgentOutput.findOne({
        userId: normalizedUserId
      }).sort({ updatedAt: -1, createdAt: -1 }).lean();
      
      if (fallback) {
        // Step 3: Log that we're using an incomplete fallback
        console.warn("[DB] Skipping invalid agentOutput, using fallback:", {
          goals: fallback?.goals?.length || 0,
          recommendations: fallback?.recommendations?.length || 0,
          updatedAt: fallback?.updatedAt
        });
        agentOutput = fallback;
      }
    }
    
    // Safety log
    console.log("[DB] Using agentOutput:", {
      goals: agentOutput?.goals?.length || 0,
      recommendations: agentOutput?.recommendations?.length || 0,
      updatedAt: agentOutput?.updatedAt,
      sessionId: agentOutput?.sessionId
    });
    
    // Get active goals from goals collection
    const goals = await Goal.find({
      userId: normalizedUserId,
      status: 'active'
    }).sort({ priority: 1 }).lean();
    
    // Get all submissions from submissions collection (sorted by lastAttemptAt DESC)
    const submissionDocs = await Submission.find({
      userId: normalizedUserId
    }).sort({ 'stats.lastAttemptAt': -1 }).lean();
    
    // Get progress history for charts
    const progressHistory = await ProgressSnapshot.find({
      userId: normalizedUserId
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    
    // Get pending actions from actions collection
    const pendingActions = await Action.find({
      userId: normalizedUserId,
      status: 'pending',
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    }).sort({ priority: 1 }).lean();
    
    // hasData = true only if we have submissions (DB is source of truth)
    const hasData = submissionDocs && submissionDocs.length > 0;
    
    console.log(`[DB] loadUserData for ${normalizedUserId}:`, {
      hasSession: !!latestSession,
      hasAgentOutput: !!agentOutput,
      goalsCount: goals?.length || 0,
      submissionsCount: submissionDocs?.length || 0,
      actionsCount: pendingActions?.length || 0,
      hasData
    });
    
    return {
      user,
      hasData: hasData, // Based on submissions, not just session existence
      session: latestSession,
      agentOutput,
      goals,
      progressHistory,
      pendingActions,
      submissionDocs, // All submission documents with analysis
      submissions: latestSession?.rawExtractedData?.submissions || [] // Raw session submissions
    };
  }, 'loadUserData');
}

/**
 * Check if user exists and has data
 */
async function checkUserExists(leetcodeUsername) {
  return safeOperation(async () => {
    const user = await User.findOne({ 
      leetcodeUsername: leetcodeUsername.toLowerCase().trim() 
    }).lean();
    
    if (!user) return { exists: false };
    
    // Check if user has any completed sessions
    const hasSession = await Session.exists({
      userId: user.userId,
      processingStatus: 'completed'
    });
    
    return {
      exists: true,
      hasData: !!hasSession,
      isGuest: user.isGuest,
      userId: user.userId
    };
  }, 'checkUserExists');
}

// ============================================
// PROBLEM METADATA OPERATIONS
// ============================================

/**
 * Get cached problem details from DB
 */
async function getProblemDetails(titleSlug) {
  return safeOperation(async () => {
    return Problem.findOne({ titleSlug: titleSlug.toLowerCase().trim() }).lean();
  }, `getProblemDetails(${titleSlug})`);
}

/**
 * Upsert problem metadata into DB
 */
async function upsertProblem(problemData) {
  return safeOperation(async () => {
    return Problem.findOneAndUpdate(
      { titleSlug: problemData.titleSlug },
      { $set: problemData },
      { upsert: true, new: true }
    );
  }, `upsertProblem(${problemData.titleSlug})`);
}

// ============================================
// EXPORTS
// ============================================

export {
  // Initialization
  initialize,
  isDBConnected,
  
  // Session
  createSession,
  updateSessionStatus,
  getRecentSessions,
  
  // User
  findOrCreateUser,
  createAuthenticatedUser,
  findUserByEmail,
  findUserById,
  updateUserStats,
  
  // Submissions
  storeSubmissionsBackground,
  storeSubmissionsAwaited,
  getSubmissionHistory,
  getUserSubmissionStats,
  getAllUserSubmissions,
  upsertSubmissionAnalysis,
  
  // Agent Output
  storeAgentOutput,
  getLatestAgentOutput,
  getAgentOutputBySession,
  
  // Goals
  storeGoalsBackground,
  getActiveGoals,
  updateGoalProgress,
  
  // Progress
  createProgressSnapshotBackground,
  getProgressHistory,
  getImprovementTrend,
  
  // Actions
  storeActionBackground,
  getPendingActions,
  completeAction,
  
  // Main
  persistExtractData,
  
  // Returning user
  loadUserData,
  buildProgressStats,
  getPreviousAgentOutput,
  checkUserExists,
  
  // Problem metadata
  getProblemDetails,
  upsertProblem
};
