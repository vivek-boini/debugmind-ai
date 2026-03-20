/**
 * Agent Exports
 * Central export point for all agent modules
 */

const { diagnose, classifyProblem, TOPIC_KEYWORDS } = require('./diagnosisAgent');
const { setGoals, updateGoalProgress, calculateTargetScore } = require('./goalAgent');
const { createPlan, adjustPlan, getProblems, PROBLEM_DATABASE } = require('./planningAgent');
const { monitor, calculateSuccessRate, detectTrend } = require('./monitoringAgent');
const { adapt, getActionFromSuccessRate, STRATEGY_MODIFICATIONS } = require('./adaptationAgent');

module.exports = {
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
