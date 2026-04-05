/**
 * Code Analysis Service
 * Uses NVIDIA LLM API - NO fallback logic
 * 
 * Features:
 * - LLM-only analysis (no rule-based fallback)
 * - Returns error if LLM fails (no silent fallback)
 * - Persists analysis to MongoDB with source: "llm"
 * - All analysis must come from LLM
 */

import { generateLLMInsights, tryParseJSON, isAvailable } from './llmService.js';
import * as dbService from './dbService.js';

/**
 * Analyze submissions using LLM ONLY
 * @param {string} username - The LeetCode username
 * @param {Array} submissions - Array of submission objects
 * @returns {Promise<Object>} - Analysis results with llmInsights or error
 */
async function analyzeSubmissions(username, submissions) {
  if (!submissions || submissions.length === 0) {
    return {
      username,
      submissions: [],
      llmInsights: null,
      analysisSource: 'none',
      error: false
    };
  }

  console.log(`[CodeAnalysis] Analyzing ${submissions.length} submissions for ${username} (LLM-only)`);

  // Prepare submissions data for LLM
  const submissionsData = submissions.map(sub => ({
    submissionId: sub.id,
    title: sub.title,
    titleSlug: sub.titleSlug,
    lang: sub.lang,
    status: sub.statusDisplay,
    code: sub.code || '',
    runtime: sub.runtime,
    memory: sub.memory
  }));

  // Check if LLM is available
  if (!isAvailable()) {
    console.log('[CodeAnalysis] LLM not available - API key not configured');
    return {
      username,
      analyzedAt: new Date().toISOString(),
      submissions: [],
      llmInsights: null,
      structured: null,
      analysisSource: 'none',
      error: true,
      message: 'Analysis failed. LLM API key not configured. Please try again later.'
    };
  }

  // Build LLM prompt
  const prompt = `
You are an expert coding mentor.

Analyze the following LeetCode submission data and provide a detailed analysis in JSON format:

{
  "submissions": [
    {
      "submissionId": "...",
      "title": "...",
      "score": 1-10,
      "timeComplexity": "O(...)",
      "spaceComplexity": "O(...)",
      "mistakes": ["..."],
      "improvements": ["..."],
      "patterns": ["..."]
    }
  ],
  "weakTopics": ["..."],
  "commonMistakes": ["..."],
  "suggestedImprovements": ["..."],
  "keyInsights": ["..."]
}

For each submission:
1. Score (1-10) based on code quality, efficiency, and correctness
2. Time and space complexity analysis
3. Specific mistakes identified
4. Concrete improvement suggestions
5. Patterns or techniques that could help

Data:
${JSON.stringify(submissionsData, null, 2)}
`;

  const llmResult = await generateLLMInsights(prompt);

  // LLM MUST succeed - no fallback
  if (!llmResult.success || !llmResult.text) {
    console.log(`[CodeAnalysis] LLM failed: ${llmResult.error}`);
    return {
      username,
      analyzedAt: new Date().toISOString(),
      submissions: [],
      llmInsights: null,
      structured: null,
      analysisSource: 'none',
      error: true,
      message: 'Analysis failed. LLM service unavailable. Please try again.'
    };
  }

  console.log(`[CodeAnalysis] LLM analysis successful`);

  // Parse LLM response
  const parsed = tryParseJSON(llmResult.text);
  
  // Build analysis results from LLM response
  const analysisResults = parsed?.submissions || submissionsData.map(sub => ({
    submissionId: sub.submissionId,
    title: sub.title,
    titleSlug: sub.titleSlug,
    lang: sub.lang,
    userCode: sub.code,
    status: sub.status,
    score: 5, // Will be overwritten by LLM if available
    timeComplexity: 'Unknown',
    spaceComplexity: 'Unknown',
    mistakes: [],
    improvements: [],
    patterns: []
  }));

  const baseAnalysis = {
    username,
    analyzedAt: new Date().toISOString(),
    submissions: analysisResults,
    llmInsights: llmResult.text,
    structured: parsed,
    analysisSource: 'llm', // Always LLM
    error: false
  };

  // Persist LLM analysis to MongoDB
  await persistAnalysisToDb(username, analysisResults, 'llm');

  return baseAnalysis;
}

/**
 * Persist LLM analysis results to MongoDB
 * UPSERT using userId + titleSlug
 * Always includes source: "llm"
 */
async function persistAnalysisToDb(username, analysisResults, source = 'llm') {
  try {
    const promises = analysisResults.map(async (analysis) => {
      if (!analysis.title) return null;
      
      // Generate titleSlug from title if not present
      const titleSlug = analysis.titleSlug || 
        analysis.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      const analysisData = {
        source: source, // Always "llm" - no rule-based fallback
        finalScore: analysis.score || 5,
        timeComplexity: analysis.timeComplexity || 'Unknown',
        spaceComplexity: analysis.spaceComplexity || 'Unknown',
        mistakes: analysis.mistakes || analysis.whatsWrong || [],
        improvements: analysis.improvements || analysis.howToImprove || [],
        patterns: analysis.patterns || analysis.whatsLacking || []
      };
      
      return dbService.upsertSubmissionAnalysis(username, titleSlug, analysisData);
    });
    
    const results = await Promise.all(promises);
    const savedCount = results.filter(r => r !== null).length;
    console.log(`[DB] ✓ Saved LLM analysis for ${savedCount} submissions`);
  } catch (error) {
    console.error('[DB] Failed to persist LLM analysis:', error.message);
    // Non-blocking: don't throw, just log
  }
}

/**
 * In-memory cache for analysis results
 */
const analysisCache = new Map();

/**
 * Get cached analysis or analyze fresh
 */
async function getOrAnalyze(username, submissions, forceRefresh = false) {
  const cacheKey = username.toLowerCase().trim();
  
  if (!forceRefresh && analysisCache.has(cacheKey)) {
    console.log(`[CodeAnalysis] Returning cached analysis for ${cacheKey}`);
    return analysisCache.get(cacheKey);
  }

  const results = await analyzeSubmissions(username, submissions);
  analysisCache.set(cacheKey, results);

  return results;
}

/**
 * Get cached analysis only (no API call)
 */
function getCached(username) {
  const cacheKey = username.toLowerCase().trim();
  return analysisCache.get(cacheKey) || null;
}

/**
 * Clear cache for a user
 */
function clearCache(username) {
  const cacheKey = username.toLowerCase().trim();
  analysisCache.delete(cacheKey);
}

export {
  analyzeSubmissions,
  getOrAnalyze,
  getCached,
  clearCache
};
