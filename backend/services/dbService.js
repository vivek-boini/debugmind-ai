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
    console.log(`[DBService] Storing ${submissions.length} submissions for ${userId} (awaited)`);
    const results = await Submission.bulkAddSubmissions(userId, submissions, sessionId);
    const successful = results.filter(r => r.success).length;
    const newCount = results.newCount || 0;
    const skippedCount = results.skippedCount || 0;
    console.log(`[Dedup] Skipped ${skippedCount} duplicate submissions for ${userId}`);
    console.log(`[DBService] ✓ Stored ${newCount} NEW submissions (${successful}/${submissions.length} successful)`);
    // Fix 7: Debug Logging
    const allDbSubmissions = await Submission.find({ userId: userId.toLowerCase().trim() }).lean();
    const totalDbCount = allDbSubmissions.reduce((acc, doc) => acc + (doc.submissions?.length || 0), 0);
    console.log(`[DB] Total submissions after insert: ${totalDbCount}`);
    
    return { total: submissions.length, successful, newCount, results };
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
      topics.forEach(t => {
        if (!topicStats[t]) {
          topicStats[t] = { attempts: 0, problemsAttempted: 0, problemsSolved: 0 };
        }
        topicStats[t].attempts += attempts;
        topicStats[t].problemsAttempted += 1;
        if (isProblemSolved) {
          topicStats[t].problemsSolved += 1;
        }
      });
    });

    const topicScores = {};
    const insufficientTopics = [];
    for (const [topic, stats] of Object.entries(topicStats)) {
      if (stats.attempts < 3) insufficientTopics.push(topic);
      topicScores[topic] = stats.problemsAttempted > 0 
        ? Math.round((stats.problemsSolved / stats.problemsAttempted) * 100) 
        : 0;
    }

    const totalProblems = submissions.length;
    const successRate = totalProblems > 0 ? Math.round((acceptedCount / totalProblems) * 100) : 0;

    return {
      totalAttempts,
      solvedCount: acceptedCount,
      totalProblems,
      successRate,
      topicScores,
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
      .sort({ createdAt: -1 })
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
    
    if (snapshots.length < 2) return { trend: 'insufficient_data' };
    
    const rates = snapshots.map(s => s.overallStats?.successRate || 0).reverse();
    const change = rates[rates.length - 1] - rates[0];
    
    return {
      trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change: Math.round(change * 10) / 10,
      dataPoints: rates.length,
      history: snapshots.reverse()
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
    
    // AWAIT submissions — LLM pipeline needs them in DB
    await storeSubmissionsAwaited(userId, submissions, sessionId);
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
    
    // Get agent output for this session (agentoutputs collection)
    const agentOutput = await AgentOutput.findOne({
      sessionId: latestSession.sessionId
    }).lean();
    
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
