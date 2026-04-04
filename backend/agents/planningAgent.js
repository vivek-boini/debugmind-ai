/**
 * Planning Agent
 * Creates adaptive learning plans based on goals
 *
 * Input: { goals }
 * Output: { plan: [...], summary }
 */

// Problem database by topic and difficulty
const PROBLEM_DATABASE = {
  'Dynamic Programming': {
    easy: [
      { id: 70, title: 'Climbing Stairs', slug: 'climbing-stairs' },
      { id: 509, title: 'Fibonacci Number', slug: 'fibonacci-number' },
      { id: 746, title: 'Min Cost Climbing Stairs', slug: 'min-cost-climbing-stairs' }
    ],
    medium: [
      { id: 198, title: 'House Robber', slug: 'house-robber' },
      { id: 322, title: 'Coin Change', slug: 'coin-change' },
      { id: 300, title: 'Longest Increasing Subsequence', slug: 'longest-increasing-subsequence' },
      { id: 62, title: 'Unique Paths', slug: 'unique-paths' }
    ],
    hard: [
      { id: 72, title: 'Edit Distance', slug: 'edit-distance' },
      { id: 312, title: 'Burst Balloons', slug: 'burst-balloons' },
      { id: 10, title: 'Regular Expression Matching', slug: 'regular-expression-matching' }
    ]
  },
  'Arrays & Hashing': {
    easy: [
      { id: 1, title: 'Two Sum', slug: 'two-sum' },
      { id: 217, title: 'Contains Duplicate', slug: 'contains-duplicate' },
      { id: 242, title: 'Valid Anagram', slug: 'valid-anagram' }
    ],
    medium: [
      { id: 49, title: 'Group Anagrams', slug: 'group-anagrams' },
      { id: 347, title: 'Top K Frequent Elements', slug: 'top-k-frequent-elements' },
      { id: 128, title: 'Longest Consecutive Sequence', slug: 'longest-consecutive-sequence' }
    ],
    hard: [
      { id: 41, title: 'First Missing Positive', slug: 'first-missing-positive' },
      { id: 76, title: 'Minimum Window Substring', slug: 'minimum-window-substring' }
    ]
  },
  'Binary Search': {
    easy: [
      { id: 704, title: 'Binary Search', slug: 'binary-search' },
      { id: 35, title: 'Search Insert Position', slug: 'search-insert-position' }
    ],
    medium: [
      { id: 33, title: 'Search in Rotated Sorted Array', slug: 'search-in-rotated-sorted-array' },
      { id: 153, title: 'Find Minimum in Rotated Sorted Array', slug: 'find-minimum-in-rotated-sorted-array' },
      { id: 74, title: 'Search a 2D Matrix', slug: 'search-a-2d-matrix' }
    ],
    hard: [
      { id: 4, title: 'Median of Two Sorted Arrays', slug: 'median-of-two-sorted-arrays' }
    ]
  },
  'Sliding Window': {
    easy: [
      { id: 121, title: 'Best Time to Buy and Sell Stock', slug: 'best-time-to-buy-and-sell-stock' }
    ],
    medium: [
      { id: 3, title: 'Longest Substring Without Repeating Characters', slug: 'longest-substring-without-repeating-characters' },
      { id: 424, title: 'Longest Repeating Character Replacement', slug: 'longest-repeating-character-replacement' },
      { id: 567, title: 'Permutation in String', slug: 'permutation-in-string' }
    ],
    hard: [
      { id: 239, title: 'Sliding Window Maximum', slug: 'sliding-window-maximum' },
      { id: 76, title: 'Minimum Window Substring', slug: 'minimum-window-substring' }
    ]
  },
  'Linked List': {
    easy: [
      { id: 206, title: 'Reverse Linked List', slug: 'reverse-linked-list' },
      { id: 21, title: 'Merge Two Sorted Lists', slug: 'merge-two-sorted-lists' },
      { id: 141, title: 'Linked List Cycle', slug: 'linked-list-cycle' }
    ],
    medium: [
      { id: 19, title: 'Remove Nth Node From End of List', slug: 'remove-nth-node-from-end-of-list' },
      { id: 143, title: 'Reorder List', slug: 'reorder-list' },
      { id: 2, title: 'Add Two Numbers', slug: 'add-two-numbers' }
    ],
    hard: [
      { id: 23, title: 'Merge k Sorted Lists', slug: 'merge-k-sorted-lists' },
      { id: 25, title: 'Reverse Nodes in k-Group', slug: 'reverse-nodes-in-k-group' }
    ]
  },
  'Trees': {
    easy: [
      { id: 104, title: 'Maximum Depth of Binary Tree', slug: 'maximum-depth-of-binary-tree' },
      { id: 226, title: 'Invert Binary Tree', slug: 'invert-binary-tree' },
      { id: 100, title: 'Same Tree', slug: 'same-tree' }
    ],
    medium: [
      { id: 102, title: 'Binary Tree Level Order Traversal', slug: 'binary-tree-level-order-traversal' },
      { id: 98, title: 'Validate Binary Search Tree', slug: 'validate-binary-search-tree' },
      { id: 230, title: 'Kth Smallest Element in a BST', slug: 'kth-smallest-element-in-a-bst' }
    ],
    hard: [
      { id: 124, title: 'Binary Tree Maximum Path Sum', slug: 'binary-tree-maximum-path-sum' },
      { id: 297, title: 'Serialize and Deserialize Binary Tree', slug: 'serialize-and-deserialize-binary-tree' }
    ]
  },
  'Graphs': {
    easy: [
      { id: 463, title: 'Island Perimeter', slug: 'island-perimeter' }
    ],
    medium: [
      { id: 200, title: 'Number of Islands', slug: 'number-of-islands' },
      { id: 133, title: 'Clone Graph', slug: 'clone-graph' },
      { id: 207, title: 'Course Schedule', slug: 'course-schedule' },
      { id: 417, title: 'Pacific Atlantic Water Flow', slug: 'pacific-atlantic-water-flow' }
    ],
    hard: [
      { id: 269, title: 'Alien Dictionary', slug: 'alien-dictionary' },
      { id: 332, title: 'Reconstruct Itinerary', slug: 'reconstruct-itinerary' }
    ]
  },
  'Backtracking': {
    easy: [],
    medium: [
      { id: 78, title: 'Subsets', slug: 'subsets' },
      { id: 46, title: 'Permutations', slug: 'permutations' },
      { id: 39, title: 'Combination Sum', slug: 'combination-sum' },
      { id: 79, title: 'Word Search', slug: 'word-search' }
    ],
    hard: [
      { id: 51, title: 'N-Queens', slug: 'n-queens' },
      { id: 37, title: 'Sudoku Solver', slug: 'sudoku-solver' }
    ]
  },
  'Stack & Queue': {
    easy: [
      { id: 20, title: 'Valid Parentheses', slug: 'valid-parentheses' },
      { id: 155, title: 'Min Stack', slug: 'min-stack' }
    ],
    medium: [
      { id: 739, title: 'Daily Temperatures', slug: 'daily-temperatures' },
      { id: 150, title: 'Evaluate Reverse Polish Notation', slug: 'evaluate-reverse-polish-notation' },
      { id: 22, title: 'Generate Parentheses', slug: 'generate-parentheses' }
    ],
    hard: [
      { id: 84, title: 'Largest Rectangle in Histogram', slug: 'largest-rectangle-in-histogram' }
    ]
  },
  'Greedy': {
    easy: [
      { id: 53, title: 'Maximum Subarray', slug: 'maximum-subarray' }
    ],
    medium: [
      { id: 55, title: 'Jump Game', slug: 'jump-game' },
      { id: 45, title: 'Jump Game II', slug: 'jump-game-ii' },
      { id: 134, title: 'Gas Station', slug: 'gas-station' }
    ],
    hard: [
      { id: 135, title: 'Candy', slug: 'candy' }
    ]
  },
  'General Problem Solving': {
    easy: [
      { id: 1, title: 'Two Sum', slug: 'two-sum' },
      { id: 9, title: 'Palindrome Number', slug: 'palindrome-number' }
    ],
    medium: [
      { id: 15, title: '3Sum', slug: '3sum' },
      { id: 11, title: 'Container With Most Water', slug: 'container-with-most-water' }
    ],
    hard: [
      { id: 42, title: 'Trapping Rain Water', slug: 'trapping-rain-water' }
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

/**
 * Get problems for a topic and difficulty
 */
function getProblems(topic, difficulty, count = 2) {
  const topicProblems = PROBLEM_DATABASE[topic] || PROBLEM_DATABASE['General Problem Solving'];
  const problems = topicProblems[difficulty] || topicProblems.easy || [];

  return problems.slice(0, count).map(p => ({
    ...p,
    url: `https://leetcode.com/problems/${p.slug}/`,
    lc_id: `LC ${p.id}`
  }));
}

/**
 * Generate day-wise plan for a goal
 */
function generatePlanForGoal(goal) {
  const { topic, deadline_days, current_score, target_score } = goal;
  const plan = [];

  // Determine phase distribution based on score gap
  const gap = target_score - current_score;
  let foundationDays, practiceDays, challengeDays, reviewDays;

  if (current_score < 30) {
    // Very weak - heavy foundation
    foundationDays = Math.ceil(deadline_days * 0.4);
    practiceDays = Math.ceil(deadline_days * 0.35);
    challengeDays = Math.ceil(deadline_days * 0.1);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  } else if (current_score < 50) {
    // Moderate weakness
    foundationDays = Math.ceil(deadline_days * 0.25);
    practiceDays = Math.ceil(deadline_days * 0.4);
    challengeDays = Math.ceil(deadline_days * 0.2);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  } else {
    // Need polish
    foundationDays = Math.ceil(deadline_days * 0.15);
    practiceDays = Math.ceil(deadline_days * 0.35);
    challengeDays = Math.ceil(deadline_days * 0.3);
    reviewDays = deadline_days - foundationDays - practiceDays - challengeDays;
  }

  let currentDay = 1;

  // Foundation phase
  for (let i = 0; i < foundationDays && currentDay <= deadline_days; i++, currentDay++) {
    plan.push({
      day: currentDay,
      phase: 'foundation',
      focus: `${topic} - Fundamentals`,
      difficulty: 'easy',
      problems: getProblems(topic, 'easy', 2),
      estimated_time: '45-60 min',
      objective: 'Understand core patterns and build confidence'
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
      objective: 'Apply concepts to varied problem types'
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
      objective: 'Test deep understanding with complex problems'
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
      objective: 'Reinforce learning and identify remaining gaps'
    });
  }

  return plan;
}

/**
 * Main planning function
 */
function createPlan(input) {
  const { goals } = input;

  if (!goals || goals.length === 0) {
    return {
      plan: [],
      summary: {
        total_days: 0,
        total_problems: 0,
        topics_covered: []
      },
      timestamp: new Date().toISOString(),
      status: 'no_goals'
    };
  }

  // Generate plans for each goal
  const allPlans = [];
  const topicPlans = {};

  for (const goal of goals) {
    const goalPlan = generatePlanForGoal(goal);
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
    current_day: 1,
    timestamp: new Date().toISOString(),
    status: 'plan_created'
  };
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
          adjusted: true
        };
      }
      if (day.topic === topic && day.difficulty === 'medium') {
        return {
          ...day,
          difficulty: 'hard',
          problems: getProblems(topic, 'hard', 1),
          adjusted: true
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
          adjusted: true
        };
      }
      if (day.topic === topic && day.difficulty === 'medium') {
        return {
          ...day,
          difficulty: 'easy',
          problems: getProblems(topic, 'easy', 2),
          adjusted: true
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
        objective: 'Additional reinforcement',
        adjusted: true
      });
    }
    newPlan.summary.total_days = lastDay + extraDays;
  }

  newPlan.last_adjusted = new Date().toISOString();
  return newPlan;
}

export { createPlan, adjustPlan, getProblems, PROBLEM_DATABASE };
