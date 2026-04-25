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
import { aggregateLLMInsights } from './codeAnalysisService.js';
import { getProblemWithCache } from './problemService.js';
import * as dbService from './dbService.js';
import { Submission } from './mongoModels.js';

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
    // Fix 7: Consistent Data Source (Always read ground truth from DB)
    const dbSubmissions = await Submission.find({ userId: userId.toLowerCase().trim() }).lean();
    if (dbSubmissions && dbSubmissions.length > 0) {
      // Flatten model since DB returns grouped by titleSlug
      submissions = dbSubmissions.flatMap(doc => doc.submissions.map(s => ({
        ...s,
        title: doc.title,
        titleSlug: doc.titleSlug,
        difficulty: doc.difficulty,
        topics: doc.topics || [],
        topicTags: doc.topics || []
      })));
    }
    // Stage 1: Extract & Store
    memory.updateAgentStage(userId, STAGES.EXTRACTING);
    memory.addSubmissions(userId, submissions);
    results.stages.extract = { status: 'success', count: submissions.length };

    // --- NEW: Step 2, 3, 4 - Compute Progress Delta ---
    const prevSession = await dbService.getPreviousAgentOutput(userId);
    const currentStats = await dbService.buildProgressStats(userId);
    
    const progressDelta = {
      improvement: [],
      decline: [],
      unchanged: [],
      overallTrend: {
        prevSuccessRate: prevSession?.diagnosis?.overall_success_rate || 0,
        currentSuccessRate: currentStats.successRate,
        delta: currentStats.successRate - (prevSession?.diagnosis?.overall_success_rate || 0)
      }
    };

    if (prevSession && prevSession.diagnosis?.confidence_scores) {
      const prevScores = prevSession.diagnosis.confidence_scores;
      const insufficientTopics = currentStats.insufficientTopics || [];
      
      for (const [topic, score] of Object.entries(currentStats.topicScores)) {
        if (insufficientTopics.includes(topic)) {
          progressDelta.unchanged.push({ topic, prevScore: prevScores[topic] || 0, currentScore: score, delta: 0, status: 'insufficient_data' });
          continue; // Skip delta compute if insufficient data
        }
        
        const prevScore = prevScores[topic] || 0;
        const delta = score - prevScore;
        const topicDelta = { topic, prevScore, currentScore: score, delta };
        
        if (delta >= 5) progressDelta.improvement.push(topicDelta);
        else if (delta <= -5) progressDelta.decline.push(topicDelta);
        else progressDelta.unchanged.push(topicDelta); // Math.abs(delta) < 5
      }
    }

    // Pass this along to memory for usage across agents
    const orchestratorContext = {
      submissions,
      prevStats: prevSession ? prevSession.diagnosis : null,
      progress: progressDelta,
      currentStats
    };

    // Stage 2: Diagnose
    memory.updateAgentStage(userId, STAGES.DIAGNOSING);
    // Augment diagnose payload
    const diagnosis = agents.diagnose(orchestratorContext);
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

    // Stage 3: Set Goals (Enhanced - now receives more diagnosis data)
    memory.updateAgentStage(userId, STAGES.SETTING_GOALS);
    const goalsResult = agents.setGoals({
      weak_topics: diagnosis.weak_topics,
      confidence_scores: diagnosis.confidence_scores,
      error_patterns: diagnosis.error_patterns,
      confidence_level: diagnosis.confidence_level,
      learning_velocity: diagnosis.learning_velocity,
      total_submissions: diagnosis.total_submissions,
      progress_delta: progressDelta
    });
    memory.storeGoals(userId, goalsResult.goals);

    // Log goal-setting decision
    const goalsLog = logger.logDecision(userId, {
      agent: 'goalAgent',
      decision: goalsResult.goals.length > 0 ? 'goals_set' : 'no_goals_needed',
      reason: goalsResult.goals.length > 0
        ? `Created ${goalsResult.goals.length} personalized goals. Top priority: ${goalsResult.most_critical} (${goalsResult.goals[0]?.description_parts?.main || 'improving skills'})`
        : 'Performance is satisfactory across all topics',
      confidence: 0.82,
      input_summary: `${diagnosis.weak_topics.length} weak topics, confidence: ${diagnosis.confidence_level}`,
      output_summary: goalsResult.goals.map(g => `${g.topic}: ${g.current_score}% → ${g.target_score}% in ${g.deadline_days} days`).join('; ')
    });
    results.decisions.push(goalsLog);

    results.stages.goals = {
      status: 'success',
      goals_count: goalsResult.goals?.length || 0,
      priority_topic: goalsResult.most_critical,
      summary: goalsResult.summary,
      explanation: goalsLog.human_readable
    };

    // Stage 4: Create Plan (Enhanced - receives diagnosis context)
    memory.updateAgentStage(userId, STAGES.PLANNING);
    const plan = agents.createPlan({ 
      goals: goalsResult.goals,
      diagnosis: diagnosis,
      error_patterns: diagnosis.error_patterns,
      confidence_level: diagnosis.confidence_level,
      learning_velocity: diagnosis.learning_velocity
    });
    memory.storePlan(userId, plan);

    // Log planning decision
    const planLog = logger.logDecision(userId, {
      agent: 'planningAgent',
      decision: 'plan_created',
      reason: `Generated ${plan.summary?.total_days}-day personalized roadmap with ${plan.summary?.total_problems} curated problems. ${plan.personalization?.[0] || 'Standard progression.'}`,
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
      classifyProblem: agents.classifyProblem,
      // Inject progress trend explicitly
      progress_delta: progressDelta
    });
    
    // Embed progress strictly
    monitoring.progress_delta = progressDelta;
    memory.storeProgress(userId, monitoring);
    console.log('[Topic Recompute]', {
      layer: 'orchestrator.runFullLoop.monitoring.by_topic',
      topics: Object.keys(monitoring?.by_topic || {})
    });

    // Log monitoring decision
    const monitorLog = logger.logDecision(userId, {
      agent: 'monitoringAgent',
      decision: monitoring.status,
      reason: `${monitoring.status_message || `Current success rate: ${monitoring.progress?.success_rate}%.`} ${monitoring.trend?.message || 'Establishing performance baseline'}`,
      confidence: monitoring.trend?.confidence === 'high' ? 0.9 : 0.7,
      input_summary: `Tracking ${submissions.length} submissions`,
      output_summary: `Status: ${monitoring.status}. Trend: ${monitoring.trend?.direction || 'establishing'}. ${monitoring.summary || ''}`
    });
    results.decisions.push(monitorLog);

    results.stages.monitor = {
      status: 'success',
      current_status: monitoring.status,
      success_rate: monitoring.progress?.success_rate,
      insights: monitoring.insights,
      explanation: monitorLog.human_readable
    };

    // Stage 6: Adaptation (Enhanced - receives diagnosis for deeper personalization)
    memory.updateAgentStage(userId, STAGES.ADAPTING);
    const adaptation = agents.adapt({
      monitoring_result: monitoring,
      current_plan: plan,
      goals: goalsResult.goals,
      diagnosis: diagnosis
    });
    memory.storeAdaptation(userId, adaptation);

    // Log adaptation decision
    const adaptLog = logger.logDecision(userId, {
      agent: 'adaptationAgent',
      decision: adaptation.action,
      reason: adaptation.summary || adaptation.reason,
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
      next_steps: adaptation.next_steps,
      explanation: adaptLog.human_readable
    };

    // Complete
    memory.updateAgentStage(userId, STAGES.COMPLETE);
    results.status = 'complete';

    // Generate actionable next steps and alerts
    const updatedState = memory.getState(userId);
    results.next_action = generateNextAction(updatedState);
    results.alerts = generateAlerts(updatedState);

    // CRITICAL: Include actual agent outputs for DB persistence
    // These are needed by persistExtractData to save to MongoDB
    results.diagnosis = updatedState.diagnosis;
    results.goals = updatedState.goals;
    results.plan = updatedState.current_plan;
    results.monitoring = updatedState.current_progress;
    results.adaptation = updatedState.current_adaptation;
    results.progress = progressDelta;

    // STEP 1: Compute metrics from submissions (MANDATORY for Progress Dashboard)
    const totalSubmissions = submissions.length;
    const accepted = submissions.filter(s => {
      const status = (s.status || s.statusDisplay || '').toLowerCase();
      return status.includes('accepted') || status === 'ac';
    }).length;
    results.metrics = {
      total_submissions: totalSubmissions,
      total_accepted: accepted,
      success_rate: totalSubmissions > 0 ? Math.round((accepted / totalSubmissions) * 100) : 0,
      overall_success_rate: diagnosis.overall_success_rate || 0
    };

    // STEP 3: Build confidence_history for chart
    const confidenceHistory = confidenceTracker.getHistory(userId);
    results.confidence_history = {
      overall_trend: confidenceHistory.overall_trend || null,
      chart_data: confidenceTracker.getChartData(userId) || null,
      summary: confidenceHistory.summary || null
    };

    // STEP 3: Also build strategy evolution for saving
    results.strategy_evolution = generateStrategyEvolution(updatedState.adaptations);

    console.log(`[Orchestrator] Full loop complete - Goals: ${results.goals?.length || 0}, Plan days: ${results.plan?.plan?.length || 0}, Metrics: ${JSON.stringify(results.metrics)}`);

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

    // CRITICAL: Include actual agent outputs for DB persistence
    results.diagnosis = finalState.diagnosis;
    results.goals = finalState.goals;
    results.plan = finalState.current_plan;
    results.monitoring = finalState.current_progress;
    results.adaptation = finalState.current_adaptation;

    // STEP 1: Compute metrics for incremental update too
    const allSubs = finalState.submissions || [];
    const totalSubs = allSubs.length;
    const acceptedSubs = allSubs.filter(s => {
      const status = (s.status || s.statusDisplay || '').toLowerCase();
      return status.includes('accepted') || status === 'ac';
    }).length;
    results.metrics = {
      total_submissions: totalSubs,
      total_accepted: acceptedSubs,
      success_rate: totalSubs > 0 ? Math.round((acceptedSubs / totalSubs) * 100) : 0,
      overall_success_rate: finalState.diagnosis?.overall_success_rate || 0
    };

    // STEP 3: Confidence history
    const confHistory = confidenceTracker.getHistory(userId);
    results.confidence_history = {
      overall_trend: confHistory.overall_trend || null,
      chart_data: confidenceTracker.getChartData(userId) || null,
      summary: confHistory.summary || null
    };

    console.log(`[Orchestrator] Incremental update complete - Goals: ${results.goals?.length || 0}, Metrics: ${JSON.stringify(results.metrics)}`);

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

/**
 * Run LLM-enhanced agent pipeline (async, non-blocking)
 * Called AFTER runLLMAnalysis completes in the background
 * 
 * 1. Fetches submission docs with LLM analysis from DB
 * 2. Aggregates LLM insights into llmSummary
 * 3. Re-runs agent pipeline with enriched data
 * 4. UPSERTs result to AgentOutput (overwrites previous for same session)
 * 5. Updates in-memory store for /agent-state
 */
async function runEnhancedAgentPipeline(userId, sessionId) {
  const sanitizedUserId = userId.toLowerCase().trim();
  console.log(`[EnhancedPipeline] Starting for ${sanitizedUserId}, session: ${sessionId}`);

  try {
    // Step 1: Fetch all submission docs (now includes LLM analysis)
    const submissionDocs = await dbService.getAllUserSubmissions(sanitizedUserId);
    if (!submissionDocs || submissionDocs.length === 0) {
      console.log('[EnhancedPipeline] No submissions found, skipping');
      return null;
    }

    // Step 2: Aggregate LLM insights
    const llmSummary = aggregateLLMInsights(submissionDocs);
    console.log(`[EnhancedPipeline] LLM Summary: ${llmSummary.analyzedCount} problems analyzed`);

    // If no LLM analysis was done, skip re-run
    if (llmSummary.analyzedCount === 0) {
      console.log('[EnhancedPipeline] No LLM analysis found, skipping re-run');
      return null;
    }

    // Step 3: Build flat submissions array from docs (for agents)
    // Enrich with problem tags from cache (no LLM calls)
    const flatSubmissions = [];
    const problemCache = new Map(); // local dedup
    for (const doc of submissionDocs) {
      // Fetch problem tags (cached, non-blocking)
      let problemTags = doc.topics || doc.topicTags || [];
      if (!problemCache.has(doc.titleSlug)) {
        try {
          const problem = await getProblemWithCache(doc.titleSlug);
          if (problem?.tags?.length) {
            problemTags = problem.tags;
          }
          problemCache.set(doc.titleSlug, { tags: problemTags, difficulty: problem?.difficulty || doc.difficulty });
        } catch (e) {
          problemCache.set(doc.titleSlug, { tags: problemTags, difficulty: doc.difficulty });
        }
      } else {
        const cached = problemCache.get(doc.titleSlug);
        problemTags = cached.tags;
      }

      for (const sub of (doc.submissions || [])) {
        flatSubmissions.push({
          title: doc.title,
          titleSlug: doc.titleSlug,
          difficulty: problemCache.get(doc.titleSlug)?.difficulty || doc.difficulty,
          status: sub.status,
          statusDisplay: sub.status,
          lang: sub.lang,
          timestamp: sub.timestamp,
          code: sub.code,
          topics: problemTags,
          topicTags: problemTags  // Real LeetCode tags for agents
        });
      }
    }

    if (flatSubmissions.length === 0) {
      console.log('[EnhancedPipeline] No flat submissions, skipping');
      return null;
    }

    // Step 4: Re-run agent loop with LLM-enriched data
    // Pass llm_analysis to diagnosis for enhanced weak topic detection
    const diagnosis = agents.diagnose({
      submissions: flatSubmissions,
      llm_analysis: llmSummary
    });
    memory.storeDiagnosis(sanitizedUserId, diagnosis);

    const goalsResult = agents.setGoals({
      weak_topics: diagnosis.weak_topics,
      confidence_scores: diagnosis.confidence_scores,
      error_patterns: diagnosis.error_patterns,
      confidence_level: diagnosis.confidence_level,
      learning_velocity: diagnosis.learning_velocity,
      total_submissions: diagnosis.total_submissions,
      llm_mistakes: llmSummary.commonMistakes
    });
    memory.storeGoals(sanitizedUserId, goalsResult.goals);

    const plan = agents.createPlan({
      goals: goalsResult.goals,
      diagnosis: diagnosis,
      error_patterns: diagnosis.error_patterns,
      confidence_level: diagnosis.confidence_level,
      learning_velocity: diagnosis.learning_velocity
    });
    memory.storePlan(sanitizedUserId, plan);

    const state = memory.getState(sanitizedUserId);
    const monitoring = agents.monitor({
      new_submissions: flatSubmissions,
      previous_progress: state.current_progress,
      goals: goalsResult.goals,
      classifyProblem: agents.classifyProblem
    });
    memory.storeProgress(sanitizedUserId, monitoring);
    console.log('[Topic Recompute]', {
      layer: 'orchestrator.runEnhancedAgentPipeline.monitoring.by_topic',
      topics: Object.keys(monitoring?.by_topic || {})
    });

    const adaptation = agents.adapt({
      monitoring_result: monitoring,
      current_plan: plan,
      goals: goalsResult.goals,
      diagnosis: diagnosis
    });
    memory.storeAdaptation(sanitizedUserId, adaptation);
    memory.updateAgentStage(sanitizedUserId, STAGES.COMPLETE);

    // Step 5: Build enriched result and UPSERT to DB
    const enrichedResult = {
      diagnosis,
      goals: goalsResult.goals,
      plan,
      monitoring,
      adaptation,
      progress: monitoring.progressDelta,
      llmSummary,
      decisions: [],
      status: 'completed',
      // STEP 1+3: Include metrics + confidence_history in enhanced pipeline too
      metrics: {
        total_submissions: flatSubmissions.length,
        total_accepted: flatSubmissions.filter(s => {
          const st = (s.status || '').toLowerCase();
          return st.includes('accepted') || st === 'ac';
        }).length,
        success_rate: flatSubmissions.length > 0
          ? Math.round((flatSubmissions.filter(s => {
              const st = (s.status || '').toLowerCase();
              return st.includes('accepted') || st === 'ac';
            }).length / flatSubmissions.length) * 100)
          : 0,
        overall_success_rate: diagnosis.overall_success_rate || 0
      },
      confidence_history: {
        overall_trend: confidenceTracker.getHistory(sanitizedUserId).overall_trend || null,
        chart_data: confidenceTracker.getChartData(sanitizedUserId) || null,
        summary: confidenceTracker.getHistory(sanitizedUserId).summary || null
      },
      strategy_evolution: generateStrategyEvolution([adaptation])
    };

    // UPSERT to AgentOutput (overwrites previous for same session)
    const savedOutput = await dbService.storeAgentOutput(sanitizedUserId, sessionId, enrichedResult);
    console.log(`[AgentOutput] ${savedOutput ? '✓ Saved' : '✗ Failed to save'} enhanced output for session: ${sessionId}`);

    // Log the decision
    logger.logDecision(sanitizedUserId, {
      agent: 'enhancedPipeline',
      decision: 'llm_enhanced_rerun',
      reason: `Re-ran pipeline with ${llmSummary.analyzedCount} LLM-analyzed problems. Found ${llmSummary.commonMistakes.length} common mistakes, ${llmSummary.weakPatterns.length} patterns.`,
      confidence: 0.9,
      input_summary: `${flatSubmissions.length} submissions, ${llmSummary.analyzedCount} with LLM analysis`,
      output_summary: `Goals: ${goalsResult.goals.length}, Plan days: ${plan?.plan?.length || 0}`
    });

    console.log(`[AgentPipeline] ✓ Completed enhanced pipeline for ${sanitizedUserId}`);
    return enrichedResult;

  } catch (error) {
    console.error('[AgentPipeline] Error:', error.message);
    console.error('[AgentPipeline] Stack:', error.stack);
    return null;
  }
}

export {
  STAGES,
  STAGE_DESCRIPTIONS,
  runFullLoop,
  runIncrementalUpdate,
  runEnhancedAgentPipeline,
  reDiagnose,
  getAgentState,
  getTodaysPlan,
  advanceDay,
  triggerAgent,
  getAgentLogs,
  getLogStats,
  getConfidenceHistory
};
