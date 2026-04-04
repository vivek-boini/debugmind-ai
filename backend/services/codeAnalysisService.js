/**
 * Code Analysis Service
 * Uses NVIDIA LLM API with safe fallback
 * 
 * Features:
 * - Primary: LLM-enhanced insights (ALWAYS used when API succeeds)
 * - Secondary: Agent-based rule analysis (fallback ONLY if API fails)
 * - NO strict JSON parsing - LLM text is always used
 * - System NEVER fails due to formatting issues
 */

import { generateLLMInsights, tryParseJSON, isAvailable } from './llmService.js';

/**
 * Analyze submissions using LLM - ALWAYS uses LLM when available
 * @param {string} username - The LeetCode username
 * @param {Array} submissions - Array of submission objects
 * @returns {Promise<Object>} - Analysis results with llmInsights
 */
async function analyzeSubmissions(username, submissions) {
  if (!submissions || submissions.length === 0) {
    return {
      username,
      submissions: [],
      llmInsights: null,
      analysisSource: 'none'
    };
  }

  console.log(`[CodeAnalysis] Analyzing ${submissions.length} submissions for ${username}`);

  // Prepare submissions data
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

  // Build base analysis from rule-based system
  const baseAnalysis = {
    username,
    analyzedAt: new Date().toISOString(),
    submissions: generateRuleBasedAnalysis(submissionsData),
    llmInsights: null,
    structured: null,
    analysisSource: 'rule-based'
  };

  // Try LLM enhancement
  if (isAvailable()) {
    const prompt = `
You are an expert coding mentor.

Analyze the following LeetCode submission data and provide:

1. Weak topics identified
2. Common mistakes made
3. Suggested improvements
4. Key insights for improvement

Be concise and structured.

Data:
${JSON.stringify(submissionsData, null, 2)}
`;

    const llmResult = await generateLLMInsights(prompt);

    // ALWAYS use LLM output if API call succeeded
    if (llmResult.success && llmResult.text) {
      baseAnalysis.llmInsights = llmResult.text;
      baseAnalysis.analysisSource = 'llm';
      console.log(`[CodeAnalysis] LLM insights applied successfully`);

      // Optional: Try to extract structured data (non-blocking)
      const parsed = tryParseJSON(llmResult.text);
      if (parsed) {
        baseAnalysis.structured = parsed;
      }
    } else {
      // Fallback ONLY if API call failed
      baseAnalysis.llmInsights = 'Using agent-based analysis (LLM unavailable)';
      console.log(`[CodeAnalysis] LLM failed, using rule-based: ${llmResult.error}`);
    }
  } else {
    baseAnalysis.llmInsights = 'Using agent-based analysis (API key not configured)';
    console.log('[CodeAnalysis] LLM not available, using rule-based analysis');
  }

  return baseAnalysis;
}

/**
 * Generate rule-based analysis (fallback when LLM unavailable)
 * @param {Array} submissionsData - Prepared submission data
 * @returns {Array} - Rule-based analysis results
 */
function generateRuleBasedAnalysis(submissionsData) {
  return submissionsData.map(sub => {
    const isAccepted = sub.status === 'Accepted';
    const hasCode = sub.code && sub.code.length > 0;
    const codeLength = hasCode ? sub.code.length : 0;
    
    let score = isAccepted ? 7 : 3;
    if (isAccepted && codeLength < 500) score = 8;
    if (isAccepted && codeLength > 2000) score = 6;
    
    const whatsLacking = [];
    const howToImprove = [];
    
    if (hasCode) {
      if (!sub.code.includes('//') && !sub.code.includes('#') && !sub.code.includes('/*')) {
        whatsLacking.push('No comments in code');
        howToImprove.push('Add comments to explain complex logic');
      }
      if (codeLength > 1500) {
        whatsLacking.push('Code may be too verbose');
        howToImprove.push('Consider refactoring into smaller functions');
      }
    }
    
    return {
      submissionId: sub.submissionId,
      title: sub.title,
      lang: sub.lang,
      userCode: sub.code,
      status: sub.status,
      verdict: isAccepted ? 'Solution accepted - review for optimizations' : 'Solution needs debugging',
      score,
      timeComplexity: 'See LLM insights',
      spaceComplexity: 'See LLM insights',
      isOptimal: false,
      whatsWrong: isAccepted ? [] : ['Solution did not pass all test cases'],
      whatsLacking,
      howToImprove
    };
  });
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
