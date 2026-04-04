/**
 * Diagnosis Agent
 * Analyzes user submissions to identify weak topics and patterns
 *
 * Input: { submissions: [...] }
 * Output: { weak_topics, confidence_scores, evidence, timestamp }
 */

// Topic classification based on LeetCode problem patterns
const TOPIC_KEYWORDS = {
  'Dynamic Programming': ['dp', 'dynamic', 'fibonacci', 'climbing', 'stairs', 'coin', 'knapsack', 'subset', 'house robber', 'longest', 'sequence'],
  'Arrays & Hashing': ['array', 'hash', 'two sum', 'contains duplicate', 'anagram', 'group', 'topk', 'frequency'],
  'Binary Search': ['binary search', 'search', 'rotated', 'sorted array', 'peak', 'minimum'],
  'Sliding Window': ['sliding', 'window', 'substring', 'maximum', 'minimum', 'subarray'],
  'Linked List': ['linked', 'list', 'reverse', 'merge', 'cycle', 'node'],
  'Trees': ['tree', 'binary tree', 'bst', 'traversal', 'inorder', 'preorder', 'postorder', 'depth', 'height'],
  'Graphs': ['graph', 'bfs', 'dfs', 'island', 'course', 'clone', 'topological'],
  'Backtracking': ['backtrack', 'permutation', 'combination', 'subset', 'n-queen', 'sudoku'],
  'Stack & Queue': ['stack', 'queue', 'valid parentheses', 'bracket', 'min stack', 'daily temperatures'],
  'Greedy': ['greedy', 'interval', 'meeting', 'jump game', 'gas station']
};

/**
 * Classify a problem into a topic based on title
 */
function classifyProblem(title) {
  const lowerTitle = title.toLowerCase();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerTitle.includes(keyword)) {
        return topic;
      }
    }
  }
  return 'General Problem Solving';
}

/**
 * Main diagnosis function
 */
function diagnose(input) {
  const { submissions } = input;

  if (!submissions || submissions.length === 0) {
    return {
      weak_topics: [],
      confidence_scores: {},
      evidence: [],
      timestamp: new Date().toISOString(),
      status: 'no_data'
    };
  }

  // Analyze submissions by topic
  const topicStats = {};
  const problemStats = {};

  submissions.forEach(sub => {
    const topic = classifyProblem(sub.title);
    const isAccepted = sub.statusDisplay === 'Accepted';

    // Initialize topic stats
    if (!topicStats[topic]) {
      topicStats[topic] = {
        total: 0,
        accepted: 0,
        failed: 0,
        problems: new Set(),
        failedProblems: [],
        avgAttempts: 0
      };
    }

    topicStats[topic].total++;
    if (isAccepted) {
      topicStats[topic].accepted++;
    } else {
      topicStats[topic].failed++;
      topicStats[topic].failedProblems.push(sub.title);
    }
    topicStats[topic].problems.add(sub.title);

    // Track per-problem stats
    if (!problemStats[sub.title]) {
      problemStats[sub.title] = { attempts: 0, accepted: false, topic };
    }
    problemStats[sub.title].attempts++;
    if (isAccepted) problemStats[sub.title].accepted = true;
  });

  // Calculate confidence scores (lower score = weaker)
  const confidence_scores = {};
  const weak_topics = [];
  const evidence = [];

  for (const [topic, stats] of Object.entries(topicStats)) {
    const successRate = stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0;
    const score = Math.round(successRate);
    confidence_scores[topic] = score;

    // Calculate attempts evidence
    const uniqueProblems = stats.problems.size;
    const avgAttempts = stats.total / uniqueProblems;

    // If success rate is below 70%, mark as weak
    if (score < 70) {
      const topicEvidence = [];
      topicEvidence.push(`Success rate: ${score}% (${stats.accepted}/${stats.total} submissions)`);

      if (stats.failedProblems.length > 0) {
        const uniqueFailed = [...new Set(stats.failedProblems)].slice(0, 3);
        topicEvidence.push(`Failed problems: ${uniqueFailed.join(', ')}`);
      }

      if (avgAttempts > 2) {
        topicEvidence.push(`Average ${avgAttempts.toFixed(1)} attempts per problem`);
      }

      weak_topics.push({
        topic,
        score,
        severity: score < 40 ? 'critical' : score < 60 ? 'high' : 'medium',
        evidence: topicEvidence,
        problem_count: uniqueProblems,
        failed_count: stats.failed
      });

      evidence.push(...topicEvidence.map(e => `[${topic}] ${e}`));
    }
  }

  // Sort weak topics by score (lowest first)
  weak_topics.sort((a, b) => a.score - b.score);

  // Find patterns
  const patterns = detectPatterns(submissions, problemStats);

  return {
    weak_topics,
    confidence_scores,
    evidence,
    patterns,
    total_submissions: submissions.length,
    total_problems: Object.keys(problemStats).length,
    overall_success_rate: Math.round(
      (submissions.filter(s => s.statusDisplay === 'Accepted').length / submissions.length) * 100
    ),
    timestamp: new Date().toISOString(),
    status: 'analyzed'
  };
}

/**
 * Detect behavioral patterns in submissions
 */
function detectPatterns(submissions, problemStats) {
  const patterns = [];

  // Pattern: Giving up too early
  const abandonedProblems = Object.entries(problemStats)
    .filter(([_, stats]) => !stats.accepted && stats.attempts < 3)
    .map(([name]) => name);

  if (abandonedProblems.length > 0) {
    patterns.push({
      type: 'early_abandonment',
      description: 'Tends to give up after few attempts',
      affected_problems: abandonedProblems.slice(0, 3),
      recommendation: 'Try at least 3-4 approaches before moving on'
    });
  }

  // Pattern: Multiple failures before success
  const hardWonProblems = Object.entries(problemStats)
    .filter(([_, stats]) => stats.accepted && stats.attempts > 4)
    .map(([name, stats]) => ({ name, attempts: stats.attempts }));

  if (hardWonProblems.length > 0) {
    patterns.push({
      type: 'persistence',
      description: 'Shows persistence on difficult problems',
      affected_problems: hardWonProblems.slice(0, 3),
      recommendation: 'Good trait! Consider reviewing optimal solutions after solving'
    });
  }

  // Pattern: Language consistency
  const languages = new Set(submissions.map(s => s.lang));
  if (languages.size > 2) {
    patterns.push({
      type: 'language_switching',
      description: 'Frequently switches between programming languages',
      languages: [...languages],
      recommendation: 'Consider mastering one language for interviews'
    });
  }

  return patterns;
}

export { diagnose, classifyProblem, TOPIC_KEYWORDS };
