/**
 * Agent Exports
 * Central export point for all agent modules
 */

import { diagnose, classifyProblem, TOPIC_KEYWORDS } from './diagnosisAgent.js';
import { setGoals, updateGoalProgress, calculateTargetScore } from './goalAgent.js';
import { createPlan, adjustPlan, getProblems, PROBLEM_DATABASE } from './planningAgent.js';
import { monitor, calculateSuccessRate, detectTrend } from './monitoringAgent.js';
import { adapt, getActionFromSuccessRate, STRATEGY_MODIFICATIONS } from './adaptationAgent.js';

export {
  // Diagnosis Agent
  diagnose,
  classifyProblem,
  TOPIC_KEYWORDS,

  // Goal Agent
  setGoals,
  updateGoalProgress,
  calculateTargetScore,

  // Planning Agent
  createPlan,
  adjustPlan,
  getProblems,
  PROBLEM_DATABASE,

  // Monitoring Agent
  monitor,
  calculateSuccessRate,
  detectTrend,

  // Adaptation Agent
  adapt,
  getActionFromSuccessRate,
  STRATEGY_MODIFICATIONS
};
