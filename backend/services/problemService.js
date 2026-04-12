/**
 * Problem Metadata Service
 * Fetches and caches LeetCode problem details via GraphQL
 * 
 * Features:
 * - fetchProblemDetails(titleSlug): LeetCode GraphQL API call
 * - getProblemWithCache(titleSlug): DB-first, fetch on miss, in-memory TTL
 * - fetchAndCacheProblems(titleSlugs): Batch fetch (max 10, rate-safe)
 * - HTML stripping, description trimming, tag normalization
 * - Graceful fallback: never crashes, returns null on failure
 */

import axios from 'axios';
import { Problem, isDBConnected } from './mongoModels.js';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

// In-memory TTL cache (24 hours)
const memoryCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Max problems to fetch in one batch (rate-limit safety)
const MAX_BATCH_SIZE = 10;

// Max description length stored (token safety)
const MAX_DESCRIPTION_LENGTH = 500;

// ============================================
// TAG NORMALIZATION MAP
// LeetCode tag slugs → consistent topic names
// ============================================
const TAG_NORMALIZE_MAP = {
  'two-pointers': 'Two Pointer',
  'sliding-window': 'Sliding Window',
  'binary-search': 'Binary Search',
  'dynamic-programming': 'Dynamic Programming',
  'depth-first-search': 'DFS',
  'breadth-first-search': 'BFS',
  'backtracking': 'Backtracking',
  'greedy': 'Greedy',
  'hash-table': 'Hash Table',
  'linked-list': 'Linked List',
  'stack': 'Stack',
  'queue': 'Queue',
  'tree': 'Tree',
  'binary-tree': 'Binary Tree',
  'binary-search-tree': 'Binary Search Tree',
  'graph': 'Graph',
  'heap-priority-queue': 'Heap',
  'trie': 'Trie',
  'sorting': 'Sorting',
  'divide-and-conquer': 'Divide and Conquer',
  'bit-manipulation': 'Bit Manipulation',
  'math': 'Math',
  'string': 'String',
  'array': 'Array',
  'matrix': 'Matrix',
  'recursion': 'Recursion',
  'union-find': 'Union Find',
  'topological-sort': 'Topological Sort',
  'monotonic-stack': 'Monotonic Stack',
  'segment-tree': 'Segment Tree',
  'prefix-sum': 'Prefix Sum',
  'simulation': 'Simulation',
  'counting': 'Counting',
  'design': 'Design',
  'database': 'Database',
  'ordered-set': 'Ordered Set',
  'number-theory': 'Number Theory',
  'geometry': 'Geometry',
  'game-theory': 'Game Theory',
  'combinatorics': 'Combinatorics',
};

/**
 * Normalize a LeetCode tag name to a consistent topic name
 */
function normalizeTag(tagName) {
  if (!tagName) return tagName;
  const slug = tagName.toLowerCase().trim().replace(/\s+/g, '-');
  return TAG_NORMALIZE_MAP[slug] || tagName; // Return original if no mapping
}

/**
 * Strip HTML tags from a string
 */
function stripHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, '')       // Remove HTML tags
    .replace(/&nbsp;/g, ' ')          // Replace &nbsp;
    .replace(/&lt;/g, '<')            // Decode &lt;
    .replace(/&gt;/g, '>')            // Decode &gt;
    .replace(/&amp;/g, '&')           // Decode &amp;
    .replace(/&quot;/g, '"')          // Decode &quot;
    .replace(/&#39;/g, "'")           // Decode &#39;
    .replace(/\n{3,}/g, '\n\n')       // Collapse excessive newlines
    .trim();
}

/**
 * Extract constraints section from problem description
 */
function extractConstraints(description) {
  if (!description) return '';
  
  // LeetCode typically has constraints in a section like:
  // Constraints:
  // - 1 <= nums.length <= 10^5
  const constraintMatch = description.match(/Constraints?:?\s*([\s\S]*?)(?:\n\n|$)/i);
  if (constraintMatch) {
    return constraintMatch[1].trim().slice(0, 300);
  }
  return '';
}

// ============================================
// LEETCODE GRAPHQL FETCHER
// ============================================

/**
 * Fetch problem details from LeetCode GraphQL API
 * Returns null on failure (never throws)
 */
async function fetchProblemDetails(titleSlug) {
  if (!titleSlug) return null;
  
  const normalizedSlug = titleSlug.toLowerCase().trim();
  console.log(`[ProblemService] Fetching from LeetCode: ${normalizedSlug}`);

  try {
    const response = await axios.post(
      LEETCODE_GRAPHQL_URL,
      {
        query: `query getProblem($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            title
            content
            difficulty
            topicTags { name slug }
            exampleTestcases
            similarQuestions
          }
        }`,
        variables: { titleSlug: normalizedSlug }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://leetcode.com'
        },
        timeout: 8000
      }
    );

    const question = response.data?.data?.question;
    if (!question) {
      console.log(`[ProblemService] No data from LeetCode for: ${normalizedSlug}`);
      return null;
    }

    // Strip HTML and trim description
    const rawDescription = stripHTML(question.content || '');
    const constraints = extractConstraints(rawDescription);
    const shortDescription = rawDescription.slice(0, MAX_DESCRIPTION_LENGTH);

    // Parse similarQuestions (LeetCode returns it as a JSON string)
    let similarProblems = [];
    try {
      if (question.similarQuestions) {
        const parsed = JSON.parse(question.similarQuestions);
        similarProblems = (Array.isArray(parsed) ? parsed : [])
          .filter(p => p && p.title && p.titleSlug)
          .map(p => ({
            title: p.title,
            titleSlug: p.titleSlug,
            difficulty: p.difficulty || 'Unknown'
          }))
          .slice(0, 5);
      }
    } catch (e) {
      console.log(`[ProblemService] Failed to parse similarQuestions for ${normalizedSlug}`);
    }

    // Multi-layer tag extraction
    // Layer 1: Primary — from topicTags API field
    let tags = (question.topicTags || [])
      .filter(t => t && t.name)
      .map(t => normalizeTag(t.name));
    
    // Layer 2: If empty — infer from description keywords
    if (tags.length === 0) {
      tags = inferTagsFromContent(question.title || '', shortDescription);
    }

    // Layer 3: Final fallback
    if (tags.length === 0) {
      tags = ['General'];
    }
    
    console.log(`[ProblemService] Tags for ${normalizedSlug}:`, tags);
    if (similarProblems.length > 0) {
      console.log(`[ProblemService] Similar problems for ${normalizedSlug}: ${similarProblems.map(p => p.title).join(', ')}`);
    }

    const problem = {
      titleSlug: normalizedSlug,
      title: question.title || normalizedSlug,
      shortDescription,
      difficulty: question.difficulty || 'Unknown',
      tags,
      examples: (question.exampleTestcases || '').slice(0, 500),
      constraints,
      similarProblems,
      fetchedAt: new Date()
    };

    console.log(`[ProblemService] ✓ Fetched: "${problem.title}" (${problem.difficulty}, ${tags.length} tags, ${similarProblems.length} similar)`);
    return problem;

  } catch (error) {
    // Rate limit or network error — fail gracefully
    if (error.response?.status === 429) {
      console.warn(`[ProblemService] Rate limited by LeetCode for: ${normalizedSlug}`);
    } else {
      console.warn(`[ProblemService] Fetch failed for "${normalizedSlug}": ${error.message}`);
    }
    return null;
  }
}

// ============================================
// CACHE LAYER (Memory + DB)
// ============================================

/**
 * Get problem with caching: Memory → DB → LeetCode API
 * Never throws. Returns null if all layers fail.
 */
async function getProblemWithCache(titleSlug) {
  if (!titleSlug) return null;
  const normalizedSlug = titleSlug.toLowerCase().trim();

  // Layer 1: In-memory cache
  const cached = memoryCache.get(normalizedSlug);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[ProblemService] Cache HIT (memory): ${normalizedSlug}`);
    return cached.data;
  }

  // Layer 2: MongoDB cache
  if (isDBConnected()) {
    try {
      const dbProblem = await Problem.findOne({ titleSlug: normalizedSlug }).lean();
      if (dbProblem) {
        console.log(`[ProblemService] Cache HIT (DB): ${normalizedSlug}`);
        // Populate memory cache
        memoryCache.set(normalizedSlug, { data: dbProblem, timestamp: Date.now() });
        return dbProblem;
      }
    } catch (err) {
      console.warn(`[ProblemService] DB lookup failed for ${normalizedSlug}: ${err.message}`);
    }
  }

  // Layer 3: Fetch from LeetCode
  console.log(`[ProblemService] Cache MISS: ${normalizedSlug}`);
  const fetched = await fetchProblemDetails(normalizedSlug);
  
  if (fetched) {
    // Store in memory cache
    memoryCache.set(normalizedSlug, { data: fetched, timestamp: Date.now() });
    
    // Store in DB (non-blocking)
    if (isDBConnected()) {
      try {
        await Problem.findOneAndUpdate(
          { titleSlug: normalizedSlug },
          { $set: fetched },
          { upsert: true, new: true }
        );
        console.log(`[ProblemService] ✓ Cached in DB: ${normalizedSlug}`);
      } catch (err) {
        console.warn(`[ProblemService] DB cache write failed for ${normalizedSlug}: ${err.message}`);
      }
    }
  }

  return fetched;
}

/**
 * Batch fetch and cache problems for a list of titleSlugs
 * Limited to MAX_BATCH_SIZE to avoid rate limiting
 * Returns Map<titleSlug, problemData>
 */
async function fetchAndCacheProblems(titleSlugs) {
  if (!titleSlugs || titleSlugs.length === 0) return new Map();

  // Deduplicate and limit
  const uniqueSlugs = [...new Set(
    titleSlugs.map(s => s?.toLowerCase().trim()).filter(Boolean)
  )].slice(0, MAX_BATCH_SIZE);

  console.log(`[ProblemService] Batch fetching ${uniqueSlugs.length} problems (from ${titleSlugs.length} total)`);

  const results = new Map();
  
  for (const slug of uniqueSlugs) {
    try {
      const problem = await getProblemWithCache(slug);
      if (problem) {
        results.set(slug, problem);
      }
      
      // Small delay between API calls to avoid rate limiting
      // Only delay if we actually hit the API (not cache)
      if (!memoryCache.has(slug)) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.warn(`[ProblemService] Batch: failed for ${slug}: ${err.message}`);
      // Continue — never block on individual failures
    }
  }

  console.log(`[ProblemService] Batch complete: ${results.size}/${uniqueSlugs.length} fetched`);
  return results;
}

// ============================================
// TAG INFERENCE FROM CONTENT (Fallback)
// ============================================

const KEYWORD_TAG_MAP = [
  { keywords: ['array', 'nums', 'sorted array'], tag: 'Array' },
  { keywords: ['string', 'substring', 'character', 'palindrome'], tag: 'String' },
  { keywords: ['tree', 'root', 'node', 'binary tree', 'bst'], tag: 'Tree' },
  { keywords: ['graph', 'edges', 'vertices', 'connected'], tag: 'Graph' },
  { keywords: ['linked list', 'listnode', 'next node'], tag: 'Linked List' },
  { keywords: ['stack', 'push', 'pop', 'parentheses', 'brackets'], tag: 'Stack' },
  { keywords: ['queue', 'fifo', 'bfs'], tag: 'Queue' },
  { keywords: ['hash', 'map', 'dictionary'], tag: 'Hash Table' },
  { keywords: ['dynamic programming', 'dp', 'memoization', 'tabulation'], tag: 'Dynamic Programming' },
  { keywords: ['binary search', 'sorted', 'mid'], tag: 'Binary Search' },
  { keywords: ['two pointer', 'pointers', 'left right'], tag: 'Two Pointer' },
  { keywords: ['sliding window', 'window', 'subarray'], tag: 'Sliding Window' },
  { keywords: ['recursion', 'recursive'], tag: 'Recursion' },
  { keywords: ['backtrack', 'permutation', 'combination'], tag: 'Backtracking' },
  { keywords: ['greedy', 'maximum', 'minimum', 'optimal'], tag: 'Greedy' },
  { keywords: ['sort', 'sorting', 'merge sort', 'quick sort'], tag: 'Sorting' },
  { keywords: ['matrix', 'grid', 'row', 'column', '2d'], tag: 'Matrix' },
  { keywords: ['heap', 'priority queue', 'kth'], tag: 'Heap' },
  { keywords: ['bit', 'xor', 'bitwise'], tag: 'Bit Manipulation' },
  { keywords: ['math', 'prime', 'factorial', 'modulo'], tag: 'Math' },
];

/**
 * Infer tags from problem title and description using keyword matching
 * Used when LeetCode API doesn't return topicTags
 */
function inferTagsFromContent(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const matched = [];

  for (const entry of KEYWORD_TAG_MAP) {
    for (const keyword of entry.keywords) {
      if (text.includes(keyword)) {
        matched.push(entry.tag);
        break; // Only add each tag once
      }
    }
  }

  return [...new Set(matched)].slice(0, 5);
}

// ============================================
// EXPORTS
// ============================================

export {
  fetchProblemDetails,
  getProblemWithCache,
  fetchAndCacheProblems,
  normalizeTag,
  stripHTML,
  extractConstraints,
  inferTagsFromContent,
  MAX_BATCH_SIZE,
  MAX_DESCRIPTION_LENGTH
};
