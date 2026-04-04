/**
 * Agent Orchestrator (Enhanced)
 * Central controller that coordinates all agents in the learning loop
 *
 * Features:
 * - Decision logging for full explainability
 * - Confidence tracking over time
 * - Next action generation
 * - Smart alerts system
 * - Strategy evolution tracking
 *
 * Flow: Extract → Diagnose → Set Goals → Plan → Monitor → Adapt → Repeat
 */

import * as agents from '../agents/index.js';
import * as memory from './memoryStore.js';
import * as logger from './agentLogger.js';
import * as confidenceTracker from './confidenceTracker.js';
import { generateNextAction, generateAlerts, generateStrategyEvolution } from './nextActionGenerator.js';

// Agent loop stages
const STAGES = {
  IDLE: 'idle',
  EXTRACTING: 'extracting',
  DIAGNOSING: 'diagnosing',
  SETTING_GOALS: 'setting_goals',
  PLANNING: 'planning',
  MONITORING: 'monitoring',
  ADAPTING: 'adapting',
  COMPLETE: 'complete'
};

// Human-readable stage descriptions for UI
const STAGE_DESCRIPTIONS = {
  idle: 'Waiting for data...',
  extracting: 'Extracting submission data...',
  diagnosing: 'Analyzing patterns and identifying weak areas...',
  setting_goals: 'Setting personalized learning goals...',
  planning: 'Creating adaptive learning plan...',
  monitoring: 'Monitoring your progress...',
  adapting: 'Adapting strategy based on performance...',
  complete: 'Analysis complete!'
};

/**
 * Run the full agent loop for a user
 * Called when new submission data is received
 */
async function runFullLoop(userId, submissions) {
  const results = {
    stages: {},
    decisions: [],
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    // Stage 1: Extract & Store
    memory.updateAgentStage(userId, STAGES.EXTRACTING);
    memory.addSubmissions(userId, submissions);
    results.stages.extract = { status: 'success', count: submissions.length };

    // Stage 2: Diagnose
    memory.updateAgentStage(userId, STAGES.DIAGNOSING);
    const diagnosis = agents.diagnose({ submissions });
    memory.storeDiagnosis(userId, diagnosis);

    // Log diagnosis decision with full explainability
    const diagnosisLog = logger.logDecision(userId, {
      agent: 'diagnosisAgent',
      decision: diagnosis.weak_topics.length > 0 ? 'weak_topics_found' : 'no_issues',
      reason: diagnosis.weak_topics.length > 0
        ? `Identified ${diagnosis.weak_topics.length} weak areas. Primary concern: ${diagnosis.weak_topics[0]?.topic} at ${diagnosis.weak_topics[0]?.score}% success rate`
        : 'All topics are performing above threshold (70%)',
      confidence: diagnosis.weak_topics.length > 0 ? 0.85 : 0.9,
      input_summary: `Analyzed ${submissions.length} submissions across ${diagnosis.total_problems} unique problems`,
      output_summary: `Overall success rate: ${diagnosis.overall_success_rate}%. Weak topics: ${diagnosis.weak_topics.length}`,
      evidence: diagnosis.evidence?.slice(0, 5) || []
    });
    results.decisions.push(diagnosisLog);

    // Track confidence scores over time
    confidenceTracker.recordConfidence(userId, diagnosis.confidence_scores, diagnosis.overall_success_rate);

    results.stages.diagnose = {
      status: 'success',
      weak_topics_count: diagnosis.weak_topics?.length || 0,
      overall_success_rate: diagnosis.overall_success_rate,
      explanation: diagnosisLog.human_readable
    };

    // Stage 3: Set Goals
    memory.updateAgentStage(userId, STAGES.SETTING_GOALS);
    const goalsResult = agents.setGoals({
      weak_topics: diagnosis.weak_topics,
      confidence_scores: diagnosis.confidence_scores,
      total_submissions: diagnosis.total_submissions
    });
    memory.storeGoals(userId, goalsResult.goals);

    // Log goal-setting decision
    const goalsLog = logger.logDecision(userId, {
      agent: 'goalAgent',
      decision: goalsResult.goals.length > 0 ? 'goals_set' : 'no_goals_needed',
      reason: goalsResult.goals.length > 0
        ? `Created ${goalsResult.goals.length} improvement goals. Top priority: ${goalsResult.most_critical} (targeting ${goalsResult.goals[0]?.target_score}%)`
        : 'Performance is satisfactory across all topics',
      confidence: 0.82,
      input_summary: `${diagnosis.weak_topics.length} weak topics requiring attention`,
      output_summary: goalsResult.goals.map(g => `${g.topic}: ${g.current_score}% → ${g.target_score}% in ${g.deadline_days} days`).join('; ')
    });
    results.decisions.push(goalsLog);

    results.stages.goals = {
      status: 'success',
      goals_count: goalsResult.goals?.length || 0,
      priority_topic: goalsResult.most_critical,
      explanation: goalsLog.human_readable
    };

    // Stage 4: Create Plan
    memory.updateAgentStage(userId, STAGES.PLANNING);
    const plan = agents.createPlan({ goals: goalsResult.goals });
    memory.storePlan(userId, plan);

    // Log planning decision
    const planLog = logger.logDecision(userId, {
      agent: 'planningAgent',
      decision: 'plan_created',
      reason: `Generated ${plan.summary?.total_days}-day learning roadmap with ${plan.summary?.total_problems} curated problems progressing from easy to hard`,
      confidence: 0.85,
      input_summary: `${goalsResult.goals.length} goals to address`,
      output_summary: `Plan covers: ${plan.summary?.topics_covered?.join(', ')}. Estimated ${plan.summary?.estimated_total_hours || 'N/A'} hours`
    });
    results.decisions.push(planLog);

    results.stages.plan = {
      status: 'success',
      total_days: plan.summary?.total_days || 0,
      total_problems: plan.summary?.total_problems || 0,
      explanation: planLog.human_readable
    };

    // Stage 5: Initial Monitoring
    memory.updateAgentStage(userId, STAGES.MONITORING);
    const state = memory.getState(userId);
    const monitoring = agents.monitor({
      new_submissions: submissions,
      previous_progress: state.current_progress,
      goals: goalsResult.goals,
      classifyProblem: agents.classifyProblem
    });
    memory.storeProgress(userId, monitoring);

    // Log monitoring decision
    const monitorLog = logger.logDecision(userId, {
      agent: 'monitoringAgent',
      decision: monitoring.status,
      reason: `Current success rate: ${monitoring.progress?.success_rate}%. ${monitoring.trend?.message || 'Establishing performance baseline'}`,
      confidence: monitoring.trend?.confidence === 'high' ? 0.9 : 0.7,
      input_summary: `Tracking ${submissions.length} submissions`,
      output_summary: `Status: ${monitoring.status}. Trend: ${monitoring.trend?.direction || 'establishing'}`
    });
    results.decisions.push(monitorLog);

    results.stages.monitor = {
      status: 'success',
      current_status: monitoring.status,
      success_rate: monitoring.progress?.success_rate,
      explanation: monitorLog.human_readable
    };

    // Stage 6: Adaptation
    memory.updateAgentStage(userId, STAGES.ADAPTING);
    const adaptation = agents.adapt({
      monitoring_result: monitoring,
      current_plan: plan,
      goals: goalsResult.goals
    });
    memory.storeAdaptation(userId, adaptation);

    // Log adaptation decision
    const adaptLog = logger.logDecision(userId, {
      agent: 'adaptationAgent',
      decision: adaptation.action,
      reason: adaptation.reason,
      confidence: (adaptation.confidence || 50) / 100,
      input_summary: `Performance: ${monitoring.status}, Success rate: ${monitoring.progress?.success_rate}%`,
      output_summary: adaptation.strategy?.message || `Action: ${adaptation.action}`,
      evidence: adaptation.recommendations?.map(r => r.text) || []
    });
    results.decisions.push(adaptLog);

    results.stages.adapt = {
      status: 'success',
      action: adaptation.action,
      confidence: adaptation.confidence,
      explanation: adaptLog.human_readable
    };

    // Complete
    memory.updateAgentStage(userId, STAGES.COMPLETE);
    results.status = 'complete';

    // Generate actionable next steps and alerts
    const updatedState = memory.getState(userId);
    results.next_action = generateNextAction(updatedState);
    results.alerts = generateAlerts(updatedState);

  } catch (error) {
    results.errors.push({
      stage: memory.getState(userId).agent_loop.current_stage,
      message: error.message,
      timestamp: new Date().toISOString()
    });
    results.status = 'error';
    console.error('[Orchestrator] Error:', error);
  }

  return results;
}

/**
 * Run incremental update (when new submissions come in)
 * Runs monitoring → adaptation → plan adjustment cycle
 */
async function runIncrementalUpdate(userId, newSubmissions) {
  const results = {
    stages: {},
    decisions: [],
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    const state = memory.getState(userId);

    // If no existing state, run full loop
    if (!state.diagnosis || !state.goals || state.goals.length === 0) {
      return runFullLoop(userId, newSubmissions);
    }

    // Add new submissions
    memory.updateAgentStage(userId, STAGES.EXTRACTING);
    memory.addSubmissions(userId, newSubmissions);
    const updatedState = memory.getState(userId);

    // Re-diagnose to update confidence scores
    const diagnosis = agents.diagnose({ submissions: updatedState.submissions });
    memory.storeDiagnosis(userId, diagnosis);
    confidenceTracker.recordConfidence(userId, diagnosis.confidence_scores, diagnosis.overall_success_rate);

    // Monitor progress
    memory.updateAgentStage(userId, STAGES.MONITORING);
    const monitoring = agents.monitor({
      new_submissions: updatedState.submissions,
      previous_progress: state.current_progress,
      goals: state.goals,
      classifyProblem: agents.classifyProblem
    });
    memory.storeProgress(userId, monitoring);

    const monitorLog = logger.logDecision(userId, {
      agent: 'monitoringAgent',
      decision: monitoring.status,
      reason: `Success rate: ${monitoring.progress?.success_rate}%. ${monitoring.trend?.message || 'Tracking progress'}`,
      confidence: monitoring.trend?.confidence === 'high' ? 0.9 : 0.7,
      input_summary: `${newSubmissions.length} new submissions added`,
      output_summary: `Status: ${monitoring.status}, Trend: ${monitoring.trend?.direction || 'stable'}`
    });
    results.decisions.push(monitorLog);

    results.stages.monitor = {
      status: 'success',
      current_status: monitoring.status,
      success_rate: monitoring.progress?.success_rate,
      trend: monitoring.trend?.direction,
      explanation: monitorLog.human_readable
    };

    // Adapt strategy if needed
    memory.updateAgentStage(userId, STAGES.ADAPTING);
    const adaptation = agents.adapt({
      monitoring_result: monitoring,
      current_plan: state.current_plan,
      goals: state.goals
    });
    memory.storeAdaptation(userId, adaptation);

    const adaptLog = logger.logDecision(userId, {
      agent: 'adaptationAgent',
      decision: adaptation.action,
      reason: adaptation.reason,
      confidence: (adaptation.confidence || 50) / 100,
      input_summary: `Status: ${monitoring.status}, Rate: ${monitoring.progress?.success_rate}%`,
      output_summary: adaptation.strategy?.message || adaptation.action
    });
    results.decisions.push(adaptLog);

    results.stages.adapt = {
      status: 'success',
      action: adaptation.action,
      reason: adaptation.reason,
      explanation: adaptLog.human_readable
    };

    // Adjust plan if adaptation requires it
    if (adaptation.plan_changes && adaptation.plan_changes.length > 0) {
      memory.updateAgentStage(userId, STAGES.PLANNING);
      let adjustedPlan = state.current_plan;

      for (const change of adaptation.plan_changes) {
        if (change.type === 'difficulty_adjustment' && state.goals.length > 0) {
          adjustedPlan = agents.adjustPlan(adjustedPlan, {
            action: adaptation.action,
            topic: state.goals[0].topic
          });
        }
      }

      memory.storePlan(userId, adjustedPlan);

      const planLog = logger.logDecision(userId, {
        agent: 'planningAgent',
        decision: 'plan_adjusted',
        reason: `Adjusted plan based on ${adaptation.action}: ${change.description || 'difficulty modified'}`,
        confidence: 0.8,
        input_summary: `Adaptation action: ${adaptation.action}`,
        output_summary: 'Learning plan updated to match new strategy'
      });
      results.decisions.push(planLog);

      results.stages.plan_adjustment = {
        status: 'success',
        changes: adaptation.plan_changes.length,
        explanation: planLog.human_readable
      };
    }

    // Check for goal achievements
    const achievedGoals = monitoring.goal_progress?.filter(gp => gp.status === 'goal_achieved') || [];
    if (achievedGoals.length > 0) {
      results.achievements = achievedGoals.map(g => ({
        topic: g.topic,
        message: `Goal achieved for ${g.topic}!`
      }));
    }

    memory.updateAgentStage(userId, STAGES.COMPLETE);
    results.status = 'complete';

    // Generate next action, alerts, and strategy evolution
    const finalState = memory.getState(userId);
    results.next_action = generateNextAction(finalState);
    results.alerts = generateAlerts(finalState);
    results.strategy_evolution = generateStrategyEvolution(finalState.adaptations);

  } catch (error) {
    results.errors.push({
      stage: memory.getState(userId).agent_loop.current_stage,
      message: error.message,
      timestamp: new Date().toISOString()
    });
    results.status = 'error';
    console.error('[Orchestrator] Incremental update error:', error);
  }

  return results;
}

/**
 * Re-diagnose and recreate goals/plan
 */
async function reDiagnose(userId) {
  const state = memory.getState(userId);

  if (!state.submissions || state.submissions.length === 0) {
    return {
      status: 'error',
      message: 'No submissions data available for diagnosis'
    };
  }

  return runFullLoop(userId, state.submissions);
}

/**
 * Get current agent state for API response (enhanced with explainability)
 */
function getAgentState(userId) {
  const state = memory.getAgentStateSummary(userId);
  const fullState = memory.getState(userId);

  // Get confidence history for charts
  const confidenceHistory = confidenceTracker.getHistory(userId);

  // Generate next action recommendation
  const nextAction = generateNextAction(fullState);

  // Generate smart alerts
  const alerts = generateAlerts(fullState);

  // Get strategy evolution (before/after)
  const strategyEvolution = generateStrategyEvolution(fullState.adaptations);

  // Get decision timeline for transparency
  const decisionTimeline = logger.getDecisionTimeline(userId, 10);

  // Enhanced state with full explainability
  const enhanced = {
    ...state,

    // Stage info for UI
    current_stage: state.agent_loop.current_stage,
    stage_description: STAGE_DESCRIPTIONS[state.agent_loop.current_stage] || 'Processing...',
    stages_info: Object.entries(STAGES).map(([key, value]) => ({
      key,
      value,
      label: key.replace(/_/g, ' ').toLowerCase(),
      description: STAGE_DESCRIPTIONS[value],
      active: state.agent_loop.current_stage === value,
      completed: isStageCompleted(state.agent_loop.stage_history, value)
    })),

    // Quick stats
    quick_stats: {
      goals_active: state.goals?.filter(g => g.status === 'active').length || 0,
      days_in_plan: state.plan?.summary?.total_days || 0,
      success_rate: state.progress?.progress?.success_rate || 0,
      current_action: state.adaptation?.action || 'none'
    },

    // Explainability features
    next_action: nextAction,
    alerts,
    strategy_evolution: strategyEvolution,
    decision_timeline: decisionTimeline,

    // Confidence tracking
    confidence_history: {
      overall_trend: confidenceHistory.overall_trend,
      chart_data: confidenceTracker.getChartData(userId),
      summary: confidenceHistory.summary
    },

    // Progress history for charts
    progress_history: fullState.progress_history?.slice(-20) || []
  };

  return enhanced;
}

/**
 * Check if a stage has been completed
 */
function isStageCompleted(stageHistory, stage) {
  if (!stageHistory || stageHistory.length === 0) return false;

  const stageOrder = [
    STAGES.EXTRACTING,
    STAGES.DIAGNOSING,
    STAGES.SETTING_GOALS,
    STAGES.PLANNING,
    STAGES.MONITORING,
    STAGES.ADAPTING,
    STAGES.COMPLETE
  ];

  const lastStage = stageHistory[stageHistory.length - 1]?.stage;
  const lastIndex = stageOrder.indexOf(lastStage);
  const currentIndex = stageOrder.indexOf(stage);

  return currentIndex <= lastIndex;
}

/**
 * Get today's plan items
 */
function getTodaysPlan(userId) {
  const state = memory.getState(userId);

  if (!state.current_plan || !state.current_plan.plan) {
    return { items: [], message: 'No plan created yet' };
  }

  const currentDay = state.current_plan.current_day || 1;
  const todaysItems = state.current_plan.plan.filter(p => p.day === currentDay);

  return {
    day: currentDay,
    items: todaysItems,
    total_problems: todaysItems.reduce((sum, item) => sum + (item.problems?.length || 0), 0)
  };
}

/**
 * Advance to next day in plan
 */
function advanceDay(userId) {
  const state = memory.getState(userId);

  if (!state.current_plan) return null;

  const currentDay = (state.current_plan.current_day || 1) + 1;
  const maxDay = state.current_plan.summary?.total_days || 1;

  if (currentDay > maxDay) {
    return {
      status: 'plan_complete',
      message: 'You have completed the learning plan!'
    };
  }

  const updatedPlan = {
    ...state.current_plan,
    current_day: currentDay
  };

  memory.storePlan(userId, updatedPlan);

  return {
    status: 'advanced',
    current_day: currentDay,
    items: getTodaysPlan(userId)
  };
}

/**
 * Manual trigger for specific agent
 */
async function triggerAgent(userId, agentName) {
  const state = memory.getState(userId);

  switch (agentName) {
    case 'diagnose':
      if (!state.submissions || state.submissions.length === 0) {
        return { error: 'No submissions data' };
      }
      const diagnosis = agents.diagnose({ submissions: state.submissions });
      memory.storeDiagnosis(userId, diagnosis);
      confidenceTracker.recordConfidence(userId, diagnosis.confidence_scores, diagnosis.overall_success_rate);

      logger.logDecision(userId, {
        agent: 'diagnosisAgent',
        decision: 'manual_diagnosis',
        reason: `Manual diagnosis triggered. Found ${diagnosis.weak_topics.length} weak topics`,
        confidence: 0.85,
        input_summary: `${state.submissions.length} submissions`,
        output_summary: `Success rate: ${diagnosis.overall_success_rate}%`
      });

      return diagnosis;

    case 'goals':
      if (!state.diagnosis) {
        return { error: 'Run diagnosis first' };
      }
      const goals = agents.setGoals({
        weak_topics: state.diagnosis.weak_topics,
        confidence_scores: state.diagnosis.confidence_scores
      });
      memory.storeGoals(userId, goals.goals);
      return goals;

    case 'plan':
      if (!state.goals || state.goals.length === 0) {
        return { error: 'Set goals first' };
      }
      const plan = agents.createPlan({ goals: state.goals });
      memory.storePlan(userId, plan);
      return plan;

    case 'monitor':
      const monitoring = agents.monitor({
        new_submissions: state.submissions,
        previous_progress: state.current_progress,
        goals: state.goals,
        classifyProblem: agents.classifyProblem
      });
      memory.storeProgress(userId, monitoring);
      return monitoring;

    case 'adapt':
      if (!state.current_progress) {
        return { error: 'Run monitoring first' };
      }
      const adaptation = agents.adapt({
        monitoring_result: state.current_progress,
        current_plan: state.current_plan,
        goals: state.goals
      });
      memory.storeAdaptation(userId, adaptation);
      return adaptation;

    default:
      return { error: `Unknown agent: ${agentName}` };
  }
}

/**
 * Get agent decision logs
 */
function getAgentLogs(userId, options = {}) {
  return logger.getLogs(userId, options);
}

/**
 * Get log statistics
 */
function getLogStats(userId) {
  return logger.getLogStats(userId);
}

/**
 * Get confidence history
 */
function getConfidenceHistory(userId, topic = null) {
  return confidenceTracker.getHistory(userId, { topic });
}

export {
  STAGES,
  STAGE_DESCRIPTIONS,
  runFullLoop,
  runIncrementalUpdate,
  reDiagnose,
  getAgentState,
  getTodaysPlan,
  advanceDay,
  triggerAgent,
  getAgentLogs,
  getLogStats,
  getConfidenceHistory
};
