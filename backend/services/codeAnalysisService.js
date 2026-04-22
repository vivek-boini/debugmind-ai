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
import { getProblemWithCache } from './problemService.js';

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

  // Sort by latest attempt DESC, take top 10 candidates
  const sorted = [...submissions]
    .sort((a, b) => {
      const timeA = a.stats?.lastAttemptAt ? new Date(a.stats.lastAttemptAt).getTime() : 0;
      const timeB = b.stats?.lastAttemptAt ? new Date(b.stats.lastAttemptAt).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 10);

  // Fix 1 + Fix 2 + Fix 3: Smart re-analysis filtering
  const toAnalyze = [];
  const skippedDocs = [];

  for (const doc of sorted) {
    // Fix 2: New submissions always get analyzed (safety fallback — even if code is missing)
    if (doc.isNew) {
      toAnalyze.push(doc);
      continue;
    }

    // Step 3: Code hash change detection
    const codeChanged =
      doc.codeHash &&
      doc.analysis?.codeHash !== doc.codeHash;

    // Smart re-analysis: analyze if never analyzed, updated since last analysis, OR code changed
    const shouldAnalyze =
      !doc.analysis ||
      !doc.analysis.lastAnalyzedAt ||
      (doc.updatedAt && new Date(doc.updatedAt).getTime() > new Date(doc.analysis.lastAnalyzedAt).getTime()) ||
      codeChanged;

    // Step 4: Per-doc debug logging
    console.log(`[LLM] ${doc.titleSlug}: codeChanged=${!!codeChanged} shouldAnalyze=${shouldAnalyze}`);

    if (shouldAnalyze) {
      toAnalyze.push(doc);
    } else {
      skippedDocs.push(doc);
    }
  }

  // Fix 3: Limit to 5 per run to control LLM costs
  const batch = toAnalyze.slice(0, 5);
  const skippedFromLimit = toAnalyze.slice(5);

  // Fix 4: Clear logging
  console.log(`[LLM] To analyze: ${batch.length} (${skippedFromLimit.length} deferred, ${skippedDocs.length} already up-to-date)`);
  result.skipped = skippedDocs.length + skippedFromLimit.length;

  if (batch.length === 0) {
    console.log(`[LLM] Nothing to analyze for ${normalizedUserId} — all submissions up-to-date`);
    return result;
  }

  for (const doc of batch) {
    try {
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

      // Fetch problem context from cache (non-blocking, null fallback)
      let problemContext = '';
      try {
        const problem = await getProblemWithCache(doc.titleSlug);
        if (problem) {
          const parts = [];
          if (problem.shortDescription) parts.push(`Description: ${problem.shortDescription}`);
          if (problem.examples) parts.push(`Examples: ${problem.examples.slice(0, 200)}`);
          if (problem.constraints) parts.push(`Constraints: ${problem.constraints.slice(0, 200)}`);
          if (problem.tags?.length) parts.push(`Tags: ${problem.tags.join(', ')}`);
          problemContext = parts.join('\n');
        }
      } catch (e) {
        // Fallback: no problem context, continue with title-only
      }

      const prompt = `Analyze this LeetCode problem attempt and return STRICT JSON only.

Problem: "${doc.title}"
Difficulty: ${doc.difficulty || 'Unknown'}
${problemContext ? `\n${problemContext}\n` : ''}
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
- mistakes: 2-3 likely mistakes based on error types, problem description, and attempt count
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
      // Fix 5: lastAnalyzedAt + codeHash set here — used for smart skip on next run
      const analysisData = {
        source: 'llm',
        mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        complexity: typeof parsed.complexity === 'string' ? parsed.complexity : '',
        improvement: typeof parsed.improvement === 'string' ? parsed.improvement : '',
        lastAnalyzedAt: new Date(),
        // Step 2+5: Store current code hash with analysis for future change detection
        codeHash: doc.codeHash || undefined
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
