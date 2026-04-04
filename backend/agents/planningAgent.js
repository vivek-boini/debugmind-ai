/**
 * Planning Agent (Enhanced)
 * Creates personalized, adaptive learning plans based on goals and diagnosis
 * 
 * Features:
 * - Problem selection based on user's specific weaknesses
 * - Personalized pace adjustment based on learning velocity
 * - Error-type focused practice sessions
 * - Smart problem rotation to avoid repetition
 *
 * Input: { goals, diagnosis, error_patterns, confidence_level, learning_velocity }
 * Output: { plan: [...], summary, personalization_notes }
 */

// Extended problem database by topic and difficulty
const PROBLEM_DATABASE = {
  'Dynamic Programming': {
    easy: [
      { id: 70, title: 'Climbing Stairs', slug: 'climbing-stairs', pattern: '1D DP', focus: 'base case' },
      { id: 509, title: 'Fibonacci Number', slug: 'fibonacci-number', pattern: 'memoization', focus: 'recursion' },
      { id: 746, title: 'Min Cost Climbing Stairs', slug: 'min-cost-climbing-stairs', pattern: '1D DP', focus: 'optimization' },
      { id: 392, title: 'Is Subsequence', slug: 'is-subsequence', pattern: 'two pointer DP', focus: 'string' }
    ],
    medium: [
      { id: 198, title: 'House Robber', slug: 'house-robber', pattern: 'linear DP', focus: 'state transition' },
      { id: 213, title: 'House Robber II', slug: 'house-robber-ii', pattern: 'circular DP', focus: 'edge cases' },
      { id: 322, title: 'Coin Change', slug: 'coin-change', pattern: 'unbounded knapsack', focus: 'optimization' },
      { id: 300, title: 'Longest Increasing Subsequence', slug: 'longest-increasing-subsequence', pattern: 'LIS', focus: 'binary search' },
      { id: 62, title: 'Unique Paths', slug: 'unique-paths', pattern: '2D DP', focus: 'grid' },
      { id: 64, title: 'Minimum Path Sum', slug: 'minimum-path-sum', pattern: '2D DP', focus: 'grid' },
      { id: 139, title: 'Word Break', slug: 'word-break', pattern: 'string DP', focus: 'partitioning' }
    ],
    hard: [
      { id: 72, title: 'Edit Distance', slug: 'edit-distance', pattern: 'string DP', focus: 'transitions' },
      { id: 312, title: 'Burst Balloons', slug: 'burst-balloons', pattern: 'interval DP', focus: 'complex state' },
      { id: 10, title: 'Regular Expression Matching', slug: 'regular-expression-matching', pattern: 'string DP', focus: 'pattern matching' },
      { id: 115, title: 'Distinct Subsequences', slug: 'distinct-subsequences', pattern: 'counting DP', focus: 'subsequence' }
    ]
  },
  'Arrays & Hashing': {
    easy: [
      { id: 1, title: 'Two Sum', slug: 'two-sum', pattern: 'hash lookup', focus: 'complement' },
      { id: 217, title: 'Contains Duplicate', slug: 'contains-duplicate', pattern: 'hash set', focus: 'detection' },
      { id: 242, title: 'Valid Anagram', slug: 'valid-anagram', pattern: 'frequency count', focus: 'comparison' },
      { id: 1, title: 'Two Sum', slug: 'two-sum', pattern: 'hash map', focus: 'indexing' },
      { id: 169, title: 'Majority Element', slug: 'majority-element', pattern: 'counting', focus: 'Boyer-Moore' }
    ],
    medium: [
      { id: 49, title: 'Group Anagrams', slug: 'group-anagrams', pattern: 'hash grouping', focus: 'key design' },
      { id: 347, title: 'Top K Frequent Elements', slug: 'top-k-frequent-elements', pattern: 'bucket sort', focus: 'frequency' },
      { id: 128, title: 'Longest Consecutive Sequence', slug: 'longest-consecutive-sequence', pattern: 'hash set', focus: 'sequence' },
      { id: 238, title: 'Product of Array Except Self', slug: 'product-of-array-except-self', pattern: 'prefix/suffix', focus: 'O(1) space' },
      { id: 36, title: 'Valid Sudoku', slug: 'valid-sudoku', pattern: 'hash validation', focus: 'grid' }
    ],
    hard: [
      { id: 41, title: 'First Missing Positive', slug: 'first-missing-positive', pattern: 'cyclic sort', focus: 'in-place' },
      { id: 76, title: 'Minimum Window Substring', slug: 'minimum-window-substring', pattern: 'sliding hash', focus: 'window' }
    ]
  },
  'Binary Search': {
    easy: [
      { id: 704, title: 'Binary Search', slug: 'binary-search', pattern: 'basic BS', focus: 'template' },
      { id: 35, title: 'Search Insert Position', slug: 'search-insert-position', pattern: 'insertion point', focus: 'boundary' },
      { id: 374, title: 'Guess Number Higher or Lower', slug: 'guess-number-higher-or-lower', pattern: 'basic BS', focus: 'interactive' }
    ],
    medium: [
      { id: 33, title: 'Search in Rotated Sorted Array', slug: 'search-in-rotated-sorted-array', pattern: 'modified BS', focus: 'rotation' },
      { id: 153, title: 'Find Minimum in Rotated Sorted Array', slug: 'find-minimum-in-rotated-sorted-array', pattern: 'modified BS', focus: 'pivot' },
      { id: 74, title: 'Search a 2D Matrix', slug: 'search-a-2d-matrix', pattern: '2D BS', focus: 'flattening' },
      { id: 875, title: 'Koko Eating Bananas', slug: 'koko-eating-bananas', pattern: 'BS on answer', focus: 'search space' },
      { id: 981, title: 'Time Based Key-Value Store', slug: 'time-based-key-value-store', pattern: 'BS insertion', focus: 'timestamps' }
    ],
    hard: [
      { id: 4, title: 'Median of Two Sorted Arrays', slug: 'median-of-two-sorted-arrays', pattern: 'partition BS', focus: 'median' },
      { id: 410, title: 'Split Array Largest Sum', slug: 'split-array-largest-sum', pattern: 'BS on answer', focus: 'minimizing maximum' }
    ]
  },
  'Sliding Window': {
    easy: [
      { id: 121, title: 'Best Time to Buy and Sell Stock', slug: 'best-time-to-buy-and-sell-stock', pattern: 'min tracking', focus: 'profit' }
    ],
    medium: [
      { id: 3, title: 'Longest Substring Without Repeating Characters', slug: 'longest-substring-without-repeating-characters', pattern: 'variable window', focus: 'uniqueness' },
      { id: 424, title: 'Longest Repeating Character Replacement', slug: 'longest-repeating-character-replacement', pattern: 'variable window', focus: 'replacement count' },
      { id: 567, title: 'Permutation in String', slug: 'permutation-in-string', pattern: 'fixed window', focus: 'anagram' },
      { id: 438, title: 'Find All Anagrams in a String', slug: 'find-all-anagrams-in-a-string', pattern: 'fixed window', focus: 'multiple matches' }
    ],
    hard: [
      { id: 239, title: 'Sliding Window Maximum', slug: 'sliding-window-maximum', pattern: 'monotonic deque', focus: 'optimization' },
      { id: 76, title: 'Minimum Window Substring', slug: 'minimum-window-substring', pattern: 'variable window', focus: 'minimum constraint' }
    ]
  },
  'Linked List': {
    easy: [
      { id: 206, title: 'Reverse Linked List', slug: 'reverse-linked-list', pattern: 'reversal', focus: 'pointer manipulation' },
      { id: 21, title: 'Merge Two Sorted Lists', slug: 'merge-two-sorted-lists', pattern: 'merge', focus: 'comparison' },
      { id: 141, title: 'Linked List Cycle', slug: 'linked-list-cycle', pattern: 'fast-slow', focus: 'detection' },
      { id: 234, title: 'Palindrome Linked List', slug: 'palindrome-linked-list', pattern: 'two pointer', focus: 'comparison' }
    ],
    medium: [
      { id: 19, title: 'Remove Nth Node From End of List', slug: 'remove-nth-node-from-end-of-list', pattern: 'two pointer', focus: 'n-ahead' },
      { id: 143, title: 'Reorder List', slug: 'reorder-list', pattern: 'reverse + merge', focus: 'interleaving' },
      { id: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', pattern: 'carry forward', focus: 'digit math' },
      { id: 142, title: 'Linked List Cycle II', slug: 'linked-list-cycle-ii', pattern: 'fast-slow', focus: 'cycle start' },
      { id: 138, title: 'Copy List with Random Pointer', slug: 'copy-list-with-random-pointer', pattern: 'hash map', focus: 'deep copy' }
    ],
    hard: [
      { id: 23, title: 'Merge k Sorted Lists', slug: 'merge-k-sorted-lists', pattern: 'heap merge', focus: 'k-way' },
      { id: 25, title: 'Reverse Nodes in k-Group', slug: 'reverse-nodes-in-k-group', pattern: 'group reversal', focus: 'k-group' }
    ]
  },
  'Trees': {
    easy: [
      { id: 104, title: 'Maximum Depth of Binary Tree', slug: 'maximum-depth-of-binary-tree', pattern: 'DFS', focus: 'depth' },
      { id: 226, title: 'Invert Binary Tree', slug: 'invert-binary-tree', pattern: 'DFS', focus: 'swap' },
      { id: 100, title: 'Same Tree', slug: 'same-tree', pattern: 'DFS', focus: 'comparison' },
      { id: 572, title: 'Subtree of Another Tree', slug: 'subtree-of-another-tree', pattern: 'DFS', focus: 'matching' },
      { id: 543, title: 'Diameter of Binary Tree', slug: 'diameter-of-binary-tree', pattern: 'DFS', focus: 'path' }
    ],
    medium: [
      { id: 102, title: 'Binary Tree Level Order Traversal', slug: 'binary-tree-level-order-traversal', pattern: 'BFS', focus: 'level' },
      { id: 98, title: 'Validate Binary Search Tree', slug: 'validate-binary-search-tree', pattern: 'inorder', focus: 'BST property' },
      { id: 230, title: 'Kth Smallest Element in a BST', slug: 'kth-smallest-element-in-a-bst', pattern: 'inorder', focus: 'counting' },
      { id: 105, title: 'Construct Binary Tree from Preorder and Inorder Traversal', slug: 'construct-binary-tree-from-preorder-and-inorder-traversal', pattern: 'construction', focus: 'index mapping' },
      { id: 236, title: 'Lowest Common Ancestor of a Binary Tree', slug: 'lowest-common-ancestor-of-a-binary-tree', pattern: 'DFS', focus: 'ancestor' }
    ],
    hard: [
      { id: 124, title: 'Binary Tree Maximum Path Sum', slug: 'binary-tree-maximum-path-sum', pattern: 'DFS', focus: 'path sum' },
      { id: 297, title: 'Serialize and Deserialize Binary Tree', slug: 'serialize-and-deserialize-binary-tree', pattern: 'serialization', focus: 'format' }
    ]
  },
  'Graphs': {
    easy: [
      { id: 463, title: 'Island Perimeter', slug: 'island-perimeter', pattern: 'grid traversal', focus: 'counting' },
      { id: 733, title: 'Flood Fill', slug: 'flood-fill', pattern: 'DFS', focus: 'connectivity' }
    ],
    medium: [
      { id: 200, title: 'Number of Islands', slug: 'number-of-islands', pattern: 'DFS', focus: 'connected components' },
      { id: 133, title: 'Clone Graph', slug: 'clone-graph', pattern: 'BFS/DFS', focus: 'deep copy' },
      { id: 207, title: 'Course Schedule', slug: 'course-schedule', pattern: 'topological sort', focus: 'cycle detection' },
      { id: 417, title: 'Pacific Atlantic Water Flow', slug: 'pacific-atlantic-water-flow', pattern: 'multi-source BFS', focus: 'boundaries' },
      { id: 130, title: 'Surrounded Regions', slug: 'surrounded-regions', pattern: 'boundary DFS', focus: 'marking' },
      { id: 994, title: 'Rotting Oranges', slug: 'rotting-oranges', pattern: 'multi-source BFS', focus: 'time tracking' }
    ],
    hard: [
      { id: 269, title: 'Alien Dictionary', slug: 'alien-dictionary', pattern: 'topological sort', focus: 'order reconstruction' },
      { id: 332, title: 'Reconstruct Itinerary', slug: 'reconstruct-itinerary', pattern: 'Eulerian path', focus: 'backtracking' },
      { id: 778, title: 'Swim in Rising Water', slug: 'swim-in-rising-water', pattern: 'binary search + BFS', focus: 'threshold' }
    ]
  },
  'Two Pointers': {
    easy: [
      { id: 125, title: 'Valid Palindrome', slug: 'valid-palindrome', pattern: 'two pointer', focus: 'comparison' },
      { id: 283, title: 'Move Zeroes', slug: 'move-zeroes', pattern: 'partition', focus: 'in-place' }
    ],
    medium: [
      { id: 15, title: '3Sum', slug: '3sum', pattern: 'sort + two pointer', focus: 'duplicates' },
      { id: 11, title: 'Container With Most Water', slug: 'container-with-most-water', pattern: 'shrinking', focus: 'optimization' },
      { id: 167, title: 'Two Sum II - Input Array Is Sorted', slug: 'two-sum-ii-input-array-is-sorted', pattern: 'two pointer', focus: 'sorted array' }
    ],
    hard: [
      { id: 42, title: 'Trapping Rain Water', slug: 'trapping-rain-water', pattern: 'two pointer', focus: 'max tracking' }
    ]
  },
  'Backtracking': {
    easy: [],
    medium: [
      { id: 78, title: 'Subsets', slug: 'subsets', pattern: 'subset generation', focus: 'power set' },
      { id: 46, title: 'Permutations', slug: 'permutations', pattern: 'permutation', focus: 'swap' },
      { id: 39, title: 'Combination Sum', slug: 'combination-sum', pattern: 'combination', focus: 'repeated use' },
      { id: 79, title: 'Word Search', slug: 'word-search', pattern: 'grid backtracking', focus: 'path finding' },
      { id: 131, title: 'Palindrome Partitioning', slug: 'palindrome-partitioning', pattern: 'partitioning', focus: 'palindrome' }
    ],
    hard: [
      { id: 51, title: 'N-Queens', slug: 'n-queens', pattern: 'constraint backtracking', focus: 'queen placement' },
      { id: 37, title: 'Sudoku Solver', slug: 'sudoku-solver', pattern: 'constraint backtracking', focus: 'validation' }
    ]
  },
  'Stack & Queue': {
    easy: [
      { id: 20, title: 'Valid Parentheses', slug: 'valid-parentheses', pattern: 'stack matching', focus: 'bracket pairs' },
      { id: 155, title: 'Min Stack', slug: 'min-stack', pattern: 'monotonic stack', focus: 'min tracking' }
    ],
    medium: [
      { id: 739, title: 'Daily Temperatures', slug: 'daily-temperatures', pattern: 'monotonic stack', focus: 'next greater' },
      { id: 150, title: 'Evaluate Reverse Polish Notation', slug: 'evaluate-reverse-polish-notation', pattern: 'stack eval', focus: 'operators' },
      { id: 22, title: 'Generate Parentheses', slug: 'generate-parentheses', pattern: 'stack generation', focus: 'valid combinations' },
      { id: 853, title: 'Car Fleet', slug: 'car-fleet', pattern: 'monotonic stack', focus: 'merging' }
    ],
    hard: [
      { id: 84, title: 'Largest Rectangle in Histogram', slug: 'largest-rectangle-in-histogram', pattern: 'monotonic stack', focus: 'area calculation' }
    ]
  },
  'Heap/Priority Queue': {
    easy: [
      { id: 703, title: 'Kth Largest Element in a Stream', slug: 'kth-largest-element-in-a-stream', pattern: 'min heap', focus: 'kth element' }
    ],
    medium: [
      { id: 215, title: 'Kth Largest Element in an Array', slug: 'kth-largest-element-in-an-array', pattern: 'heap/quickselect', focus: 'selection' },
      { id: 347, title: 'Top K Frequent Elements', slug: 'top-k-frequent-elements', pattern: 'heap', focus: 'frequency' },
      { id: 973, title: 'K Closest Points to Origin', slug: 'k-closest-points-to-origin', pattern: 'max heap', focus: 'distance' },
      { id: 621, title: 'Task Scheduler', slug: 'task-scheduler', pattern: 'max heap', focus: 'cooldown' }
    ],
    hard: [
      { id: 295, title: 'Find Median from Data Stream', slug: 'find-median-from-data-stream', pattern: 'two heaps', focus: 'median' },
      { id: 23, title: 'Merge k Sorted Lists', slug: 'merge-k-sorted-lists', pattern: 'min heap', focus: 'k-way merge' }
    ]
  },
  'Greedy': {
    easy: [
      { id: 53, title: 'Maximum Subarray', slug: 'maximum-subarray', pattern: 'Kadane', focus: 'max sum' }
    ],
    medium: [
      { id: 55, title: 'Jump Game', slug: 'jump-game', pattern: 'reach tracking', focus: 'reachability' },
      { id: 45, title: 'Jump Game II', slug: 'jump-game-ii', pattern: 'BFS/greedy', focus: 'min jumps' },
      { id: 134, title: 'Gas Station', slug: 'gas-station', pattern: 'circular', focus: 'deficit tracking' },
      { id: 763, title: 'Partition Labels', slug: 'partition-labels', pattern: 'last occurrence', focus: 'partitioning' }
    ],
    hard: [
      { id: 135, title: 'Candy', slug: 'candy', pattern: 'two pass', focus: 'constraints' }
    ]
  },
  'General Problem Solving': {
    easy: [
      { id: 1, title: 'Two Sum', slug: 'two-sum', pattern: 'hash', focus: 'lookup' },
      { id: 9, title: 'Palindrome Number', slug: 'palindrome-number', pattern: 'math', focus: 'reversal' },
      { id: 202, title: 'Happy Number', slug: 'happy-number', pattern: 'cycle detection', focus: 'fast-slow' }
    ],
    medium: [
      { id: 15, title: '3Sum', slug: '3sum', pattern: 'two pointer', focus: 'sorting' },
      { id: 11, title: 'Container With Most Water', slug: 'container-with-most-water', pattern: 'greedy', focus: 'optimization' }
    ],
    hard: [
      { id: 42, title: 'Trapping Rain Water', slug: 'trapping-rain-water', pattern: 'two pointer', focus: 'boundaries' }
    ]
  }
};

// Learning phase descriptions
const PHASES = {
  foundation: {
    name: 'Foundation',
    description: 'Build core understanding with easy problems',
    difficulty: 'easy',
    problems_per_day: 2
  },
  practice: {
    name: 'Practice',
    description: 'Apply concepts with medium problems',
    difficulty: 'medium',
    problems_per_day: 2
  },
  challenge: {
    name: 'Challenge',
    description: 'Test mastery with hard problems',
    difficulty: 'hard',
    problems_per_day: 1
  },
  review: {
    name: 'Review',
    description: 'Consolidate learning and revisit weak spots',
    difficulty: 'mixed',
    problems_per_day: 2
  }
};

// Track used problems to avoid repetition
let usedProblems = new Set();

/**
 * Get problems for a topic and difficulty with smart selection
 */
function getProblems(topic, difficulty, count = 2, excludeUsed = true) {
  const topicProblems = PROBLEM_DATABASE[topic] || PROBLEM_DATABASE['General Problem Solving'];
  let problems = [...(topicProblems[difficulty] || topicProblems.easy || [])];

  // Filter out already used problems if requested
  if (excludeUsed) {
    problems = problems.filter(p => !usedProblems.has(p.id));
  }

  // If not enough problems after filtering, reset and use all
  if (problems.length < count) {
    problems = [...(topicProblems[difficulty] || topicProblems.easy || [])];
  }

  // Shuffle for variety
  problems = shuffleArray(problems);

  // Select and mark as used
  const selected = problems.slice(0, count);
  selected.forEach(p => usedProblems.add(p.id));

  return selected.map(p => ({
    ...p,
    topic,
    difficulty,
    url: `https://leetcode.com/problems/${p.slug}/`,
    lc_id: `LC ${p.id}`
  }));
}

/**
 * Reset used problems tracker (call when starting new plan)
 */
function resetUsedProblems() {
  usedProblems = new Set();
}

/**
 * Shuffle array using Fisher-Yates
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate personalized day objective based on context
 */
function generateDayObjective(topic, phase, userContext) {
  const objectives = {
    foundation: {
      'Dynamic Programming': 'Build DP intuition by identifying subproblems and base cases',
      'Arrays & Hashing': 'Master hash map operations for O(1) lookups',
      'Binary Search': 'Perfect the binary search template and understand boundaries',
      'Trees': 'Understand recursive tree traversal patterns',
      'Graphs': 'Master BFS/DFS templates on grid problems',
      default: `Build foundational understanding of ${topic}`
    },
    practice: {
      'Dynamic Programming': 'Practice state transitions and optimize solutions',
      'Arrays & Hashing': 'Apply hash techniques to complex scenarios',
      'Binary Search': 'Handle rotated arrays and search space problems',
      'Trees': 'Solve tree property and path problems',
      'Graphs': 'Handle cycle detection and topological sorting',
      default: `Apply ${topic} concepts to varied problems`
    },
    challenge: {
      'Dynamic Programming': 'Tackle complex multi-dimensional DP',
      'Arrays & Hashing': 'Solve space-optimized in-place problems',
      'Binary Search': 'Master advanced partition and median problems',
      'Trees': 'Handle complex path sums and serialization',
      'Graphs': 'Solve advanced shortest path problems',
      default: `Master advanced ${topic} techniques`
    },
    review: {
      default: `Reinforce ${topic} learning and address remaining gaps`
    }
  };

  return objectives[phase]?.[topic] || objectives[phase]?.default || `Focus on ${topic}`;
}

/**
 * Generate day-wise plan for a goal with personalization
 */
function generatePlanForGoal(goal, diagnosis = {}, learningVelocity = {}) {
  const { topic, deadline_days, current_score, target_score, related_errors = [] } = goal;
  const plan = [];

  // Reset used problems for this plan
  resetUsedProblems();

  // Determine phase distribution based on score gap and learning velocity
  const gap = target_score - current_score;
  let foundationDays, practiceDays, challengeDays, reviewDays;

  // Adjust based on learning velocity
  const isAccelerating = learningVelocity?.direction === 'accelerating';
  const isDeclining = learningVelocity?.direction === 'declining';

  if (current_score < 30 || isDeclining) {
    // Very weak or declining - heavy foundation
    foundationDays = Math.ceil(deadline_days * (isDeclining ? 0.5 : 0.4));
    practiceDays = Math.ceil(deadline_days * 0.35);
    challengeDays = Math.ceil(deadline_days * 0.05);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  } else if (current_score < 50) {
    // Moderate weakness
    foundationDays = Math.ceil(deadline_days * 0.25);
    practiceDays = Math.ceil(deadline_days * 0.4);
    challengeDays = Math.ceil(deadline_days * 0.2);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  } else if (isAccelerating) {
    // Improving - can push harder
    foundationDays = Math.ceil(deadline_days * 0.1);
    practiceDays = Math.ceil(deadline_days * 0.35);
    challengeDays = Math.ceil(deadline_days * 0.4);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  } else {
    // Need polish
    foundationDays = Math.ceil(deadline_days * 0.15);
    practiceDays = Math.ceil(deadline_days * 0.35);
    challengeDays = Math.ceil(deadline_days * 0.3);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  }

  let currentDay = 1;

  // Generate personalized tips based on errors
  const errorTip = related_errors.length > 0
    ? `Focus on avoiding ${related_errors[0]} errors`
    : null;

  // Foundation phase
  for (let i = 0; i < foundationDays && currentDay <= deadline_days; i++, currentDay++) {
    plan.push({
      day: currentDay,
      phase: 'foundation',
      focus: `${topic} - Fundamentals`,
      difficulty: 'easy',
      problems: getProblems(topic, 'easy', 2),
      estimated_time: '45-60 min',
      objective: generateDayObjective(topic, 'foundation', {}),
      tips: errorTip ? [errorTip, 'Take time to understand patterns'] : ['Take time to understand patterns']
    });
  }

  // Practice phase
  for (let i = 0; i < practiceDays && currentDay <= deadline_days; i++, currentDay++) {
    plan.push({
      day: currentDay,
      phase: 'practice',
      focus: `${topic} - Application`,
      difficulty: 'medium',
      problems: getProblems(topic, 'medium', 2),
      estimated_time: '60-90 min',
      objective: generateDayObjective(topic, 'practice', {}),
      tips: errorTip ? [errorTip, 'Test with edge cases'] : ['Test with edge cases']
    });
  }

  // Challenge phase
  for (let i = 0; i < challengeDays && currentDay <= deadline_days; i++, currentDay++) {
    plan.push({
      day: currentDay,
      phase: 'challenge',
      focus: `${topic} - Mastery Test`,
      difficulty: 'hard',
      problems: getProblems(topic, 'hard', 1),
      estimated_time: '90-120 min',
      objective: generateDayObjective(topic, 'challenge', {}),
      tips: ["Don't give up - hard problems build resilience", 'Use hints if stuck for 30+ minutes']
    });
  }

  // Review phase
  for (let i = 0; i < reviewDays && currentDay <= deadline_days; i++, currentDay++) {
    plan.push({
      day: currentDay,
      phase: 'review',
      focus: `${topic} - Review & Consolidate`,
      difficulty: 'mixed',
      problems: [
        ...getProblems(topic, 'easy', 1),
        ...getProblems(topic, 'medium', 1)
      ],
      estimated_time: '45-60 min',
      objective: generateDayObjective(topic, 'review', {}),
      tips: ['Review solutions you struggled with', 'Practice explaining your approach']
    });
  }

  return plan;
}

/**
 * Main planning function with enhanced personalization
 */
function createPlan(input) {
  const { 
    goals, 
    diagnosis = {},
    error_patterns = [],
    confidence_level = 'medium',
    learning_velocity = {}
  } = input;

  if (!goals || goals.length === 0) {
    return {
      plan: [],
      summary: {
        total_days: 0,
        total_problems: 0,
        topics_covered: [],
        personalization: 'No goals to plan for'
      },
      timestamp: new Date().toISOString(),
      status: 'no_goals'
    };
  }

  // Reset used problems for fresh plan
  resetUsedProblems();

  // Generate plans for each goal
  const allPlans = [];
  const topicPlans = {};

  for (const goal of goals) {
    const goalPlan = generatePlanForGoal(goal, diagnosis, learning_velocity);
    topicPlans[goal.topic] = goalPlan;

    goalPlan.forEach(day => {
      allPlans.push({
        ...day,
        topic: goal.topic,
        goal_id: goal.id
      });
    });
  }

  // Merge and interleave if multiple goals
  let mergedPlan = [];
  if (goals.length === 1) {
    mergedPlan = allPlans;
  } else {
    // Interleave topics for variety
    const maxDays = Math.max(...goals.map(g => g.deadline_days));
    for (let day = 1; day <= maxDays; day++) {
      const dayPlans = allPlans.filter(p => p.day === day);
      mergedPlan.push(...dayPlans);
    }
  }

  // Calculate summary
  const totalProblems = mergedPlan.reduce((sum, day) => sum + day.problems.length, 0);
  const topicsCovered = [...new Set(mergedPlan.map(d => d.topic))];

  // Generate personalization notes
  const personalizationNotes = generatePersonalizationNotes(
    goals, 
    confidence_level, 
    learning_velocity, 
    error_patterns
  );

  return {
    plan: mergedPlan,
    topic_plans: topicPlans,
    summary: {
      total_days: Math.max(...mergedPlan.map(d => d.day)),
      total_problems: totalProblems,
      topics_covered: topicsCovered,
      phases: Object.keys(PHASES),
      estimated_total_hours: Math.round(totalProblems * 0.75)
    },
    personalization: personalizationNotes,
    current_day: 1,
    timestamp: new Date().toISOString(),
    status: 'plan_created'
  };
}

/**
 * Generate personalization notes for the plan
 */
function generatePersonalizationNotes(goals, confidenceLevel, learningVelocity, errorPatterns) {
  const notes = [];

  // Add velocity-based note
  if (learningVelocity?.direction === 'accelerating') {
    notes.push('Plan includes more challenging problems due to your improving performance');
  } else if (learningVelocity?.direction === 'declining') {
    notes.push('Plan focuses on fundamentals to rebuild confidence');
  }

  // Add confidence-based note
  if (confidenceLevel === 'low' || confidenceLevel === 'very_low') {
    notes.push('Extended foundation phases to ensure solid understanding');
  } else if (confidenceLevel === 'high') {
    notes.push('Accelerated progression with focus on advanced techniques');
  }

  // Add error-specific notes
  if (errorPatterns.length > 0) {
    const topError = errorPatterns[0];
    if (topError.error_type === 'Wrong Answer') {
      notes.push('Emphasis on edge case testing and logic verification');
    } else if (topError.error_type === 'Time Limit Exceeded') {
      notes.push('Focus on algorithm optimization and complexity analysis');
    }
  }

  // Add topic-specific notes
  const criticalGoals = goals.filter(g => g.severity === 'critical');
  if (criticalGoals.length > 0) {
    notes.push(`Priority focus on ${criticalGoals.map(g => g.topic).join(', ')}`);
  }

  return notes.length > 0 ? notes : ['Standard learning plan based on your current progress'];
}

/**
 * Adjust plan based on adaptation
 */
function adjustPlan(currentPlan, adaptation) {
  const { action, topic } = adaptation;
  const newPlan = JSON.parse(JSON.stringify(currentPlan));

  if (action === 'increase_difficulty') {
    // Promote remaining easy/medium days to higher difficulty
    newPlan.plan = newPlan.plan.map(day => {
      if (day.topic === topic && day.difficulty === 'easy') {
        return {
          ...day,
          difficulty: 'medium',
          problems: getProblems(topic, 'medium', 2),
          adjusted: true,
          adjustment_reason: 'Performance improving - increased difficulty'
        };
      }
      if (day.topic === topic && day.difficulty === 'medium') {
        return {
          ...day,
          difficulty: 'hard',
          problems: getProblems(topic, 'hard', 1),
          adjusted: true,
          adjustment_reason: 'Performance improving - increased difficulty'
        };
      }
      return day;
    });
  } else if (action === 'simplify_problems') {
    // Demote remaining medium/hard days
    newPlan.plan = newPlan.plan.map(day => {
      if (day.topic === topic && day.difficulty === 'hard') {
        return {
          ...day,
          difficulty: 'medium',
          problems: getProblems(topic, 'medium', 2),
          adjusted: true,
          adjustment_reason: 'Struggling - reduced difficulty for reinforcement'
        };
      }
      if (day.topic === topic && day.difficulty === 'medium') {
        return {
          ...day,
          difficulty: 'easy',
          problems: getProblems(topic, 'easy', 2),
          adjusted: true,
          adjustment_reason: 'Struggling - reduced difficulty for reinforcement'
        };
      }
      return day;
    });
  } else if (action === 'extend_deadline') {
    // Add extra days
    const lastDay = Math.max(...newPlan.plan.map(d => d.day));
    const extraDays = 3;
    for (let i = 1; i <= extraDays; i++) {
      newPlan.plan.push({
        day: lastDay + i,
        phase: 'review',
        topic,
        focus: `${topic} - Extended Practice`,
        difficulty: 'mixed',
        problems: [
          ...getProblems(topic, 'easy', 1),
          ...getProblems(topic, 'medium', 1)
        ],
        estimated_time: '45-60 min',
        objective: 'Additional reinforcement with varied difficulty',
        adjusted: true,
        adjustment_reason: 'Extended deadline for additional practice'
      });
    }
    newPlan.summary.total_days = lastDay + extraDays;
  }

  newPlan.last_adjusted = new Date().toISOString();
  return newPlan;
}

export { createPlan, adjustPlan, getProblems, PROBLEM_DATABASE, resetUsedProblems };
