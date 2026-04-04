/**
 * Agent Exports
 * Central export point for all agent modules
 */

import { diagnose, classifyProblem, normalizeStatus, TOPIC_KEYWORDS, ERROR_PATTERNS } from './diagnosisAgent.js';
import { setGoals, updateGoalProgress, calculateTargetScore } from './goalAgent.js';
import { createPlan, adjustPlan, getProblems, PROBLEM_DATABASE, resetUsedProblems } from './planningAgent.js';
import { monitor, calculateSuccessRate, detectTrend, normalizeStatus as monitorNormalizeStatus } from './monitoringAgent.js';
import { adapt, getActionFromSuccessRate, STRATEGY_MODIFICATIONS } from './adaptationAgent.js';

export {
  // Diagnosis Agent
  diagnose,
  classifyProblem,
  normalizeStatus,
  TOPIC_KEYWORDS,
  ERROR_PATTERNS,

  // Goal Agent
  setGoals,
  updateGoalProgress,
  calculateTargetScore,

  // Planning Agent
  createPlan,
  adjustPlan,
  getProblems,
  PROBLEM_DATABASE,
  resetUsedProblems,

  // Monitoring Agent
  monitor,
  calculateSuccessRate,
  detectTrend,

  // Adaptation Agent
  adapt,
  getActionFromSuccessRate,
  STRATEGY_MODIFICATIONS
};
