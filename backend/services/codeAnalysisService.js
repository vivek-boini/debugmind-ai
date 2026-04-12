/**
 * Code Analysis Service (Refactored)
 * Now runs LLM analysis during extract phase, NOT on demand
 * 
 * Features:
 * - runLLMAnalysis(userId): Analyzes latest problems via GROQ LLM
 * - Lightweight prompts (NO full code sent to LLM)
 * - Stores results in Submission.analysis field (MongoDB)
 * - Skips already-analyzed problems (idempotent)
 * - Non-blocking: continues on individual failures
 * 
 * Migration: Removed in-memory cache, removed on-demand analysis
 */

import { generateLLMInsights, tryParseJSON, isAvailable } from './llmService.js';
import * as dbService from './dbService.js';

/**
 * Run LLM analysis for a user's recent submissions
 * Called async during extract phase — NEVER blocks API response
 * 
 * @param {string} userId - The LeetCode username (normalized)
 * @returns {Promise<{analyzed: number, skipped: number, errors: number}>}
 */
async function runLLMAnalysis(userId) {
  const result = { analyzed: 0, skipped: 0, errors: 0 };
  const normalizedUserId = userId.toLowerCase().trim();

  console.log(`[LLM] Starting analysis for ${normalizedUserId}`);

  // Check if LLM is available
  if (!isAvailable()) {
    console.log('[LLM] LLM not available - API key not configured');
    return result;
  }

  // Fetch all submission docs from MongoDB
  const submissions = await dbService.getAllUserSubmissions(normalizedUserId);
  console.log(`[LLM] Found submissions: ${submissions?.length || 0} for ${normalizedUserId}`);
  
  if (!submissions || submissions.length === 0) {
    console.log(`[LLM] No submissions found for ${normalizedUserId} — check if persistExtractData completed`);
    return result;
  }

  // Sort by latest attempt DESC, take top 10
  const sorted = [...submissions]
    .sort((a, b) => {
      const timeA = a.stats?.lastAttemptAt ? new Date(a.stats.lastAttemptAt).getTime() : 0;
      const timeB = b.stats?.lastAttemptAt ? new Date(b.stats.lastAttemptAt).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 10);

  console.log(`[CodeAnalysis] Analyzing ${sorted.length} problems for ${userId} (LLM)`);

  for (const doc of sorted) {
    try {
      // Skip if already analyzed
      if (doc.analysis && doc.analysis.lastAnalyzedAt) {
        result.skipped++;
        continue;
      }

      // Build LIGHTWEIGHT prompt — NO full code
      const acceptedCount = doc.stats?.acceptedCount || 0;
      const totalAttempts = doc.stats?.totalAttempts || 0;
      const successRate = totalAttempts > 0 ? Math.round((acceptedCount / totalAttempts) * 100) : 0;
      const isSolved = doc.stats?.isSolved || false;

      // Collect error types from submissions
      const errorTypes = {};
      for (const sub of (doc.submissions || [])) {
        const status = sub.status || 'Other';
        if (status !== 'Accepted') {
          errorTypes[status] = (errorTypes[status] || 0) + 1;
        }
      }
      const errorSummary = Object.entries(errorTypes)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ') || 'None';

      const prompt = `Analyze this LeetCode problem attempt and return STRICT JSON only.

Problem: "${doc.title}"
Difficulty: ${doc.difficulty || 'Unknown'}
Total Attempts: ${totalAttempts}
Accepted: ${acceptedCount}
Success Rate: ${successRate}%
Solved: ${isSolved ? 'Yes' : 'No'}
Error Types: ${errorSummary}
Topics: ${(doc.topics || []).join(', ') || 'Unknown'}

Return this exact JSON structure:
{
  "mistakes": ["mistake 1", "mistake 2"],
  "patterns": ["pattern 1", "pattern 2"],
  "complexity": "O(n) time, O(1) space",
  "improvement": "specific improvement suggestion"
}

Rules:
- mistakes: 2-3 likely mistakes based on error types and attempt count
- patterns: 2 algorithmic patterns relevant to this problem
- complexity: expected optimal complexity for this problem type
- improvement: 1 concrete improvement tip`;

      const llmResult = await generateLLMInsights(prompt, {
        maxTokens: 300,
        temperature: 0.3,
      });

      if (!llmResult.success || !llmResult.text) {
        console.log(`[CodeAnalysis] LLM failed for "${doc.title}": ${llmResult.error}`);
        result.errors++;
        continue;
      }

      // Parse JSON response
      const parsed = tryParseJSON(llmResult.text);
      if (!parsed) {
        console.log(`[CodeAnalysis] Failed to parse LLM JSON for "${doc.title}"`);
        result.errors++;
        continue;
      }

      // UPSERT analysis into Submission collection
      const analysisData = {
        source: 'llm',
        mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        complexity: typeof parsed.complexity === 'string' ? parsed.complexity : '',
        improvement: typeof parsed.improvement === 'string' ? parsed.improvement : '',
        lastAnalyzedAt: new Date()
      };

      await dbService.upsertSubmissionAnalysis(userId, doc.titleSlug, analysisData);
      result.analyzed++;

      console.log(`[CodeAnalysis] ✓ Analyzed "${doc.title}"`);

    } catch (err) {
      // NEVER block if one fails — continue loop
      console.error(`[CodeAnalysis] Error analyzing "${doc.title}":`, err.message);
      result.errors++;
    }
  }

  console.log(`[LLM] Completed for ${normalizedUserId}: ${result.analyzed} analyzed, ${result.skipped} skipped, ${result.errors} errors`);
  return result;
}

/**
 * Aggregate LLM analysis from all submission docs into a summary
 * Used by agent pipeline to enhance inputs
 * 
 * @param {Array} submissionDocs - Submission documents from MongoDB  
 * @returns {Object} llmSummary
 */
function aggregateLLMInsights(submissionDocs) {
  const commonMistakes = [];
  const weakPatterns = [];
  const improvementAreas = [];
  let analyzedCount = 0;

  for (const doc of (submissionDocs || [])) {
    if (!doc.analysis || !doc.analysis.lastAnalyzedAt) continue;
    analyzedCount++;

    if (Array.isArray(doc.analysis.mistakes)) {
      commonMistakes.push(...doc.analysis.mistakes);
    }
    if (Array.isArray(doc.analysis.patterns)) {
      weakPatterns.push(...doc.analysis.patterns);
    }
    if (doc.analysis.improvement) {
      improvementAreas.push(doc.analysis.improvement);
    }
  }

  // Deduplicate
  return {
    commonMistakes: [...new Set(commonMistakes)].slice(0, 10),
    weakPatterns: [...new Set(weakPatterns)].slice(0, 10),
    improvementAreas: [...new Set(improvementAreas)].slice(0, 10),
    analyzedCount,
    lastAnalyzedAt: new Date()
  };
}

export {
  runLLMAnalysis,
  aggregateLLMInsights
};
