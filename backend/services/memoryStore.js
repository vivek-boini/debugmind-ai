/**
 * Agent Memory Store
 * Manages persistent state for the agentic learning system
 *
 * Storage: In-memory (MVP) with optional MongoDB support
 */

// In-memory store
const memoryStore = new Map();

// Fix 1: Pipeline execution lock
const inFlight = new Map();

function tryStartPipeline(userId) {
  const normalizedId = userId.toLowerCase();
  if (inFlight.get(normalizedId)) return false;
  inFlight.set(normalizedId, true);
  return true;
}

function endPipeline(userId) {
  inFlight.delete(userId.toLowerCase());
}

// State schema
const createInitialState = (userId) => ({
  user_id: userId,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),

  // Raw data
  submissions: [],
  submissions_history: [],

  // Agent outputs
  diagnosis: null,
  goals: [],
  current_plan: null,

  // Progress tracking
  progress_history: [],
  current_progress: null,

  // Adaptation history
  adaptations: [],
  current_adaptation: null,

  // Agent loop state
  agent_loop: {
    current_stage: 'idle',
    stage_history: [],
    last_run: null,
    total_runs: 0
  },

  // Metrics
  metrics: {
    total_submissions: 0,
    total_accepted: 0,
    total_problems: 0,
    streak_days: 0,
    longest_streak: 0
  }
});

/**
 * Get user state (creates if doesn't exist)
 */
function getState(userId) {
  const normalizedId = userId.toLowerCase();

  if (!memoryStore.has(normalizedId)) {
    memoryStore.set(normalizedId, createInitialState(normalizedId));
  }

  return memoryStore.get(normalizedId);
}

/**
 * Update user state
 */
function updateState(userId, updates) {
  const normalizedId = userId.toLowerCase();
  const currentState = getState(normalizedId);

  const newState = {
    ...currentState,
    ...updates,
    updated_at: new Date().toISOString()
  };

  memoryStore.set(normalizedId, newState);
  return newState;
}

/**
 * Update specific field in state
 */
function updateField(userId, field, value) {
  return updateState(userId, { [field]: value });
}

/**
 * Add submission data
 */
function addSubmissions(userId, submissions) {
  const state = getState(userId);

  // Merge with existing submissions (avoid duplicates)
  const existingIds = new Set(state.submissions.map(s => s.id || `${s.title}-${s.timestamp}`));
  const newSubmissions = submissions.filter(s => !existingIds.has(s.id || `${s.title}-${s.timestamp}`));

  const mergedSubmissions = [...newSubmissions, ...state.submissions];

  // Update metrics
  const metrics = {
    total_submissions: mergedSubmissions.length,
    total_accepted: mergedSubmissions.filter(s => s.statusDisplay === 'Accepted').length,
    total_problems: new Set(mergedSubmissions.map(s => s.title)).size
  };

  return updateState(userId, {
    submissions: mergedSubmissions,
    submissions_history: [
      ...state.submissions_history,
      {
        timestamp: new Date().toISOString(),
        count: newSubmissions.length,
        total: mergedSubmissions.length
      }
    ],
    metrics: { ...state.metrics, ...metrics }
  });
}

/**
 * Store diagnosis result
 */
function storeDiagnosis(userId, diagnosis) {
  return updateState(userId, { diagnosis });
}

/**
 * Store goals
 */
function storeGoals(userId, goals) {
  return updateState(userId, { goals: goals.goals || goals });
}

/**
 * Store plan
 */
function storePlan(userId, plan) {
  return updateState(userId, { current_plan: plan });
}

/**
 * Store progress
 */
function storeProgress(userId, progress) {
  const state = getState(userId);

  return updateState(userId, {
    current_progress: progress,
    progress_history: [
      ...state.progress_history,
      {
        ...progress,
        recorded_at: new Date().toISOString()
      }
    ].slice(-50) // Keep last 50 records
  });
}

/**
 * Store adaptation
 */
function storeAdaptation(userId, adaptation) {
  const state = getState(userId);

  return updateState(userId, {
    current_adaptation: adaptation,
    adaptations: [
      ...state.adaptations,
      {
        ...adaptation,
        applied_at: new Date().toISOString()
      }
    ].slice(-20) // Keep last 20 adaptations
  });
}

/**
 * Update agent loop stage
 */
function updateAgentStage(userId, stage) {
  const state = getState(userId);

  return updateState(userId, {
    agent_loop: {
      ...state.agent_loop,
      current_stage: stage,
      stage_history: [
        ...state.agent_loop.stage_history,
        {
          stage,
          timestamp: new Date().toISOString()
        }
      ].slice(-100),
      last_run: new Date().toISOString(),
      total_runs: state.agent_loop.total_runs + 1
    }
  });
}

/**
 * Get full agent state summary
 */
function getAgentStateSummary(userId) {
  const state = getState(userId);

  return {
    user_id: state.user_id,

    // Current state
    diagnosis: state.diagnosis ? {
      weak_topics: state.diagnosis.weak_topics,
      overall_success_rate: state.diagnosis.overall_success_rate,
      timestamp: state.diagnosis.timestamp
    } : null,

    goals: state.goals,
    plan: state.current_plan ? {
      summary: state.current_plan.summary,
      current_day: state.current_plan.current_day,
      plan: state.current_plan.plan?.slice(0, 7) // Next 7 days
    } : null,

    progress: state.current_progress,
    adaptation: state.current_adaptation ? {
      action: state.current_adaptation.action,
      reason: state.current_adaptation.reason,
      recommendations: state.current_adaptation.recommendations
    } : null,

    // Loop status
    agent_loop: state.agent_loop,

    // Metrics
    metrics: state.metrics,

    // Timestamps
    created_at: state.created_at,
    updated_at: state.updated_at
  };
}

/**
 * Check if user exists
 */
function hasUser(userId) {
  return memoryStore.has(userId.toLowerCase());
}

/**
 * Delete user state
 */
function deleteState(userId) {
  return memoryStore.delete(userId.toLowerCase());
}

/**
 * Get all user IDs
 */
function getAllUsers() {
  const result = {};
  for (const [key, value] of memoryStore.entries()) {
    result[key] = value;
  }
  return result;
}

/**
 * Get all user IDs (keys only)
 */
function getAllUserIds() {
  return Array.from(memoryStore.keys());
}

/**
 * Export state (for debugging/backup)
 */
function exportState(userId) {
  return JSON.parse(JSON.stringify(getState(userId)));
}

/**
 * Import state (for restore)
 */
function importState(userId, state) {
  memoryStore.set(userId.toLowerCase(), {
    ...state,
    imported_at: new Date().toISOString()
  });
}

export {
  getState,
  updateState,
  updateField,
  addSubmissions,
  storeDiagnosis,
  storeGoals,
  storePlan,
  storeProgress,
  storeAdaptation,
  updateAgentStage,
  getAgentStateSummary,
  hasUser,
  deleteState,
  getAllUsers,
  getAllUserIds,
  exportState,
  importState,
  tryStartPipeline,
  endPipeline
};
