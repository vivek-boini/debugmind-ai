/**
 * MongoDB Models and Database Configuration
 * All models defined in a single file for easy import
 * 
 * Collections:
 * - User
 * - Session
 * - Submission
 * - AgentOutput
 * - Goal
 * - ProgressSnapshot
 * - Action
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// DATABASE CONNECTION
// ============================================

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

let isConnected = false;
let connectionAttempts = 0;

async function connectDB() {
  if (isConnected) {
    return true;
  }

  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.warn('[MongoDB] MONGODB_URI not set. Running in memory-only mode.');
    return false;
  }

  while (connectionAttempts < MAX_RETRIES) {
    try {
      connectionAttempts++;
      console.log(`[MongoDB] Connection attempt ${connectionAttempts}/${MAX_RETRIES}...`);
      
      await mongoose.connect(mongoUri);
      
      isConnected = true;
      connectionAttempts = 0;
      console.log('[MongoDB] Connected successfully');
      
      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDB] Disconnected');
        isConnected = false;
      });

      mongoose.connection.on('error', (err) => {
        console.error('[MongoDB] Error:', err.message);
      });

      return true;
    } catch (error) {
      console.error(`[MongoDB] Connection failed:`, error.message);
      
      if (connectionAttempts < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  console.error('[MongoDB] All connection attempts failed. Running in memory-only mode.');
  connectionAttempts = 0;
  return false;
}

function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

// ============================================
// USER MODEL
// ============================================

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6,
    select: false
  },
  leetcodeUsername: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  displayName: String,
  authType: {
    type: String,
    enum: ['password', 'guest'],
    default: 'guest'
  },
  isGuest: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  lastSessionId: String, // Track most recent session for quick access
  preferences: {
    dailyGoal: { type: Number, default: 3 },
    preferredTopics: [String],
    difficulty: { type: String, default: 'mixed' }
  },
  stats: {
    totalSessions: { type: Number, default: 0 },
    totalSubmissions: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastExtractDate: Date
  }
}, { timestamps: true });

// Enhanced indexes
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ leetcodeUsername: 1 });
userSchema.index({ lastActive: -1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  // Set isGuest based on whether password is provided
  if (this.password) {
    this.isGuest = false;
    this.authType = 'password';
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.statics.findOrCreateGuest = async function(leetcodeUsername) {
  const normalizedUsername = leetcodeUsername.toLowerCase().trim();
  let user = await this.findOne({ userId: normalizedUsername });
  
  if (!user) {
    user = await this.create({
      userId: normalizedUsername,
      leetcodeUsername: normalizedUsername,
      authType: 'guest',
      isGuest: true
    });
  }
  return user;
};

// Check if user exists by email or username
userSchema.statics.findExistingUser = async function(email, leetcodeUsername) {
  const query = [];
  if (email) query.push({ email: email.toLowerCase() });
  if (leetcodeUsername) query.push({ leetcodeUsername: leetcodeUsername.toLowerCase() });
  
  if (query.length === 0) return null;
  return this.findOne({ $or: query });
};

const User = mongoose.model('User', userSchema);

// ============================================
// TOPIC NORMALIZATION HELPER
// ============================================

const TOPIC_NORMALIZATION_MAP = {
  'array': 'arrays',
  'arrays': 'arrays',
  'dynamic programming': 'dp',
  'dp': 'dp',
  'dynamicprogramming': 'dp',
  'binary search': 'binary-search',
  'binarysearch': 'binary-search',
  'linked list': 'linked-list',
  'linkedlist': 'linked-list',
  'two pointers': 'two-pointers',
  'twopointers': 'two-pointers',
  'sliding window': 'sliding-window',
  'slidingwindow': 'sliding-window',
  'hash table': 'hash-table',
  'hashtable': 'hash-table',
  'hashmap': 'hash-table',
  'stack': 'stack',
  'queue': 'queue',
  'tree': 'tree',
  'trees': 'tree',
  'binary tree': 'binary-tree',
  'binarytree': 'binary-tree',
  'graph': 'graph',
  'graphs': 'graph',
  'bfs': 'bfs',
  'dfs': 'dfs',
  'backtracking': 'backtracking',
  'greedy': 'greedy',
  'heap': 'heap',
  'priority queue': 'heap',
  'math': 'math',
  'string': 'string',
  'strings': 'string',
  'recursion': 'recursion',
  'sorting': 'sorting',
  'bit manipulation': 'bit-manipulation',
  'divide and conquer': 'divide-and-conquer',
  'trie': 'trie'
};

function normalizeTopic(topic) {
  if (!topic) return 'other';
  const normalized = topic.toLowerCase().trim();
  return TOPIC_NORMALIZATION_MAP[normalized] || normalized.replace(/\s+/g, '-');
}

function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return [...new Set(topics.map(normalizeTopic))];
}

// ============================================
// SESSION MODEL (Append-Only)
// ============================================

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  rawExtractedData: {
    submissions: [{
      id: String,
      title: String,
      titleSlug: String,
      status: String,
      statusDisplay: String,
      lang: String,
      language: String,
      code: String,
      runtime: String,
      memory: String,
      timestamp: mongoose.Schema.Types.Mixed,
      difficulty: String,
      topicTags: [String]
    }],
    metadata: {
      extractionTimestamp: Date,
      source: String,
      extensionVersion: String
    }
  },
  summaryStats: {
    totalSubmissions: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    uniqueProblems: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    languages: [String],
    difficulties: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 }
    }
  },
  // Enhanced metadata
  analysisResults: {
    weakTopics: [String],
    strongTopics: [String],
    overallSuccessRate: Number,
    confidenceLevel: String,
    topicsAnalyzed: [String]
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: String,
  processingDuration: Number,
  agentOutputId: mongoose.Schema.Types.ObjectId,
  agentVersion: {
    type: String,
    default: '2.2.0'
  }
}, { timestamps: true });

// Enhanced indexes for better query performance
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ sessionId: 1 }, { unique: true });
sessionSchema.index({ processingStatus: 1, createdAt: -1 });

sessionSchema.pre('save', function(next) {
  if (this.isModified('rawExtractedData')) {
    const submissions = this.rawExtractedData?.submissions || [];
    const accepted = submissions.filter(s => 
      (s.status?.toLowerCase().includes('accepted') || s.statusDisplay?.toLowerCase().includes('accepted'))
    );
    
    const difficulties = { easy: 0, medium: 0, hard: 0 };
    submissions.forEach(s => {
      const diff = s.difficulty?.toLowerCase();
      if (diff && difficulties[diff] !== undefined) difficulties[diff]++;
    });
    
    const totalSubmissions = submissions.length;
    const acceptedCount = accepted.length;
    
    this.summaryStats = {
      totalSubmissions,
      acceptedCount,
      uniqueProblems: new Set(submissions.map(s => s.title || s.titleSlug)).size,
      successRate: totalSubmissions > 0 ? Math.round((acceptedCount / totalSubmissions) * 100) : 0,
      languages: [...new Set(submissions.map(s => s.lang || s.language).filter(Boolean))],
      difficulties
    };
  }
  next();
});

sessionSchema.statics.createFromExtract = async function(userId, submissions, metadata = {}) {
  return this.create({
    userId: userId.toLowerCase().trim(),
    rawExtractedData: {
      submissions,
      metadata: { extractionTimestamp: new Date(), ...metadata }
    },
    processingStatus: 'pending'
  });
};

const Session = mongoose.model('Session', sessionSchema);

// ============================================
// SUBMISSION MODEL
// ============================================

const submissionEntrySchema = new mongoose.Schema({
  code: String,
  runtime: String,
  runtimeMs: Number,
  memory: String,
  memoryMb: Number,
  status: {
    type: String,
    enum: ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 
           'Memory Limit Exceeded', 'Compile Error', 'Other'],
    default: 'Other'
  },
  statusDisplay: String,
  language: String,
  sessionId: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const submissionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  problemId: {
    type: String,
    index: true
  },
  titleSlug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'Unknown'],
    default: 'Unknown'
  },
  topics: [String],
  topicTags: [String],
  submissions: [submissionEntrySchema],
  stats: {
    totalAttempts: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    wrongAnswerCount: { type: Number, default: 0 },
    tleCount: { type: Number, default: 0 },
    firstAttemptAt: Date,
    lastAttemptAt: Date,
    firstAcceptedAt: Date,
    bestRuntime: String,
    bestMemory: String,
    isSolved: { type: Boolean, default: false },
    attemptsToSolve: Number
  },
  // LLM Analysis results (LLM-only - no fallback)
  analysis: {
    source: { type: String, enum: ['llm', 'none'], default: 'llm' }, // Always "llm"
    finalScore: { type: Number, min: 0, max: 100 },
    timeComplexity: String,
    spaceComplexity: String,
    mistakes: [String],
    improvements: [String],
    patterns: [String],
    lastAnalyzedAt: Date
  }
}, { timestamps: true });

// PRIMARY UNIQUE KEY: userId + titleSlug (NOT problemId)
submissionSchema.index({ userId: 1, titleSlug: 1 }, { unique: true });
submissionSchema.index({ userId: 1, 'stats.isSolved': 1 });

function normalizeStatus(status) {
  if (!status) return 'Other';
  const s = status.toLowerCase();
  if (s.includes('accepted') || s === 'ac') return 'Accepted';
  if (s.includes('wrong')) return 'Wrong Answer';
  if (s.includes('time limit') || s === 'tle') return 'Time Limit Exceeded';
  if (s.includes('runtime')) return 'Runtime Error';
  if (s.includes('memory limit')) return 'Memory Limit Exceeded';
  if (s.includes('compile')) return 'Compile Error';
  return 'Other';
}

/**
 * Generate a titleSlug from a title string if none is provided.
 * e.g. "Two Sum" => "two-sum"
 */
function generateTitleSlug(title) {
  if (!title) return 'unknown';
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

submissionSchema.statics.addSubmission = async function(userId, submissionData, sessionId) {
  const normalizedUserId = userId.toLowerCase().trim();
  
  // PRIMARY KEY: titleSlug (normalized to lowercase)
  const titleSlug = (submissionData.titleSlug || generateTitleSlug(submissionData.title)).toLowerCase().trim();
  // Keep problemId for backward compatibility, but NOT used for uniqueness
  const problemId = submissionData.id || titleSlug;
  
  const newEntry = {
    code: submissionData.code,
    runtime: submissionData.runtime,
    runtimeMs: parseFloat(submissionData.runtime) || null,
    memory: submissionData.memory,
    memoryMb: parseFloat(submissionData.memory) || null,
    status: normalizeStatus(submissionData.status || submissionData.statusDisplay),
    statusDisplay: submissionData.statusDisplay || submissionData.status,
    language: submissionData.lang || submissionData.language,
    sessionId,
    timestamp: submissionData.timestamp ? new Date(submissionData.timestamp * 1000) : new Date()
  };

  // UPSERT by userId + titleSlug (NOT problemId)
  let doc = await this.findOne({ userId: normalizedUserId, titleSlug });
  
  if (!doc) {
    // Step 3: Document does NOT exist → CREATE new
    const rawTopics = submissionData.topicTags || submissionData.topics || [];
    const normalizedTopics = normalizeTopics(rawTopics);
    
    doc = new this({
      userId: normalizedUserId,
      problemId,
      titleSlug,
      title: submissionData.title || titleSlug,
      difficulty: submissionData.difficulty ? 
        submissionData.difficulty.charAt(0).toUpperCase() + submissionData.difficulty.slice(1).toLowerCase() : 
        'Unknown',
      topics: normalizedTopics,
      topicTags: rawTopics,
      submissions: []
    });
  } else {
    // Step 2: Document exists → PUSH new submission, UPDATE updatedAt
    const newTopics = submissionData.topicTags || submissionData.topics || [];
    if (newTopics.length > 0) {
      const mergedTopics = [...new Set([...doc.topics, ...normalizeTopics(newTopics)])];
      doc.topics = mergedTopics;
    }
    // Update problemId if we have a better one
    if (submissionData.id && submissionData.id !== doc.problemId) {
      doc.problemId = submissionData.id;
    }
  }

  // Check for duplicate submission (same timestamp + status)
  const isDuplicate = doc.submissions.some(s => 
    s.timestamp?.getTime() === newEntry.timestamp?.getTime() && 
    s.status === newEntry.status
  );
  
  if (!isDuplicate) {
    doc.submissions.push(newEntry);
  }
  
  // Recompute stats
  const subs = doc.submissions;
  const accepted = subs.filter(s => s.status === 'Accepted');
  const wrongAnswer = subs.filter(s => s.status === 'Wrong Answer');
  const tle = subs.filter(s => s.status === 'Time Limit Exceeded');
  const sortedByTime = [...subs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const firstAccepted = sortedByTime.find(s => s.status === 'Accepted');
  
  doc.stats = {
    totalAttempts: subs.length,
    acceptedCount: accepted.length,
    wrongAnswerCount: wrongAnswer.length,
    tleCount: tle.length,
    firstAttemptAt: sortedByTime[0]?.timestamp,
    lastAttemptAt: sortedByTime[sortedByTime.length - 1]?.timestamp,
    firstAcceptedAt: firstAccepted?.timestamp,
    bestRuntime: accepted.length > 0 ? 
      accepted.reduce((best, curr) => 
        (parseFloat(curr.runtime) || Infinity) < (parseFloat(best.runtime) || Infinity) ? curr : best
      ).runtime : null,
    bestMemory: accepted.length > 0 ?
      accepted.reduce((best, curr) => 
        (parseFloat(curr.memory) || Infinity) < (parseFloat(best.memory) || Infinity) ? curr : best
      ).memory : null,
    isSolved: accepted.length > 0,
    attemptsToSolve: firstAccepted ? sortedByTime.indexOf(firstAccepted) + 1 : null
  };

  await doc.save();
  return doc;
};

submissionSchema.statics.bulkAddSubmissions = async function(userId, submissions, sessionId) {
  const results = [];
  for (const sub of submissions) {
    try {
      const result = await this.addSubmission(userId, sub, sessionId);
      results.push({ success: true, problemId: result.problemId });
    } catch (error) {
      results.push({ success: false, problemId: sub.title, error: error.message });
    }
  }
  return results;
};

/**
 * UPSERT analysis for a submission (LLM-only analysis)
 * Uses userId + titleSlug as the unique key
 * Always includes source: "llm"
 */
submissionSchema.statics.upsertAnalysis = async function(userId, titleSlug, analysisData) {
  const normalizedUserId = userId.toLowerCase().trim();
  const normalizedSlug = titleSlug.toLowerCase().trim();
  
  const update = {
    'analysis.source': analysisData.source || 'llm', // Always LLM
    'analysis.finalScore': analysisData.finalScore,
    'analysis.timeComplexity': analysisData.timeComplexity,
    'analysis.spaceComplexity': analysisData.spaceComplexity,
    'analysis.mistakes': analysisData.mistakes || [],
    'analysis.improvements': analysisData.improvements || [],
    'analysis.patterns': analysisData.patterns || [],
    'analysis.lastAnalyzedAt': new Date()
  };
  
  const result = await this.findOneAndUpdate(
    { userId: normalizedUserId, titleSlug: normalizedSlug },
    { $set: update },
    { new: true, upsert: false } // Only update if exists - don't create
  );
  
  if (result) {
    console.log(`[DB] ✓ Saved LLM analysis for ${titleSlug}`);
  }
  
  return result;
};

const Submission = mongoose.model('Submission', submissionSchema);

// ============================================
// AGENT OUTPUT MODEL
// ============================================

const agentOutputSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  diagnosis: {
    weak_topics: [{
      topic: String,
      score: Number,
      evidence: [String],
      submissions_count: Number
    }],
    overall_success_rate: Number,
    total_submissions: Number,
    total_problems: Number,
    confidence_scores: mongoose.Schema.Types.Mixed,
    error_patterns: mongoose.Schema.Types.Mixed,
    timestamp: Date
  },
  goals: [{
    topic: String,
    current_score: Number,
    target_score: Number,
    priority: Number,
    timeframe: String,
    actions: [String]
  }],
  plan: {
    summary: String,
    duration_days: Number,
    current_day: Number,
    plan: [{
      day: Number,
      focus: String,
      items: [{
        type: String,
        topic: String,
        problems: [mongoose.Schema.Types.Mixed],
        duration: String
      }]
    }]
  },
  monitoring: {
    metrics: mongoose.Schema.Types.Mixed,
    trends: mongoose.Schema.Types.Mixed,
    alerts: [String]
  },
  adaptation: {
    action: String,
    reason: String,
    recommendations: [mongoose.Schema.Types.Mixed],
    adjustments: mongoose.Schema.Types.Mixed
  },
  decisions: [{
    agent: String,
    decision: String,
    reason: String,
    confidence: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  processingTime: Number,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  }
}, { timestamps: true });

agentOutputSchema.index({ userId: 1, createdAt: -1 });
agentOutputSchema.index({ sessionId: 1 });

agentOutputSchema.statics.createFromLoopResult = async function(userId, sessionId, loopResult) {
  return this.create({
    userId: userId.toLowerCase().trim(),
    sessionId,
    diagnosis: loopResult.diagnosis,
    goals: loopResult.goals,
    plan: loopResult.plan,
    monitoring: loopResult.monitoring,
    adaptation: loopResult.adaptation,
    decisions: loopResult.decisions || [],
    status: 'completed'
  });
};

const AgentOutput = mongoose.model('AgentOutput', agentOutputSchema);

// ============================================
// GOAL MODEL
// ============================================

const goalSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  goalId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },
  sessionId: String, // Session that created this goal
  title: {
    type: String,
    required: true
  },
  description: String,
  topic: String,
  targetMetric: {
    type: { type: String, enum: ['success_rate', 'problems_solved', 'streak_days', 'custom'] },
    value: Number,
    unit: String
  },
  currentMetric: {
    value: Number,
    lastUpdated: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'abandoned'],
    default: 'active'
  },
  priority: {
    type: Number,
    default: 1
  },
  progress: [{
    value: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  completedAt: Date,
  dueDate: Date
}, { timestamps: true });

goalSchema.index({ userId: 1, status: 1 });
goalSchema.index({ userId: 1, topic: 1 });

goalSchema.statics.createFromAgentGoals = async function(userId, sessionId, agentGoals) {
  const goals = [];
  for (const g of agentGoals) {
    const goal = await this.create({
      userId: userId.toLowerCase().trim(),
      sessionId,
      title: `Improve ${g.topic}`,
      description: `Increase ${g.topic} success rate from ${g.current_score}% to ${g.target_score}%`,
      topic: g.topic,
      targetMetric: {
        type: 'success_rate',
        value: g.target_score,
        unit: 'percent'
      },
      currentMetric: {
        value: g.current_score,
        lastUpdated: new Date()
      },
      priority: g.priority || 1
    });
    goals.push(goal);
  }
  return goals;
};

const Goal = mongoose.model('Goal', goalSchema);

// ============================================
// PROGRESS SNAPSHOT MODEL
// ============================================

const progressSnapshotSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  topicStats: {
    type: Map,
    of: {
      attempts: Number,
      accepted: Number,
      successRate: Number,
      avgAttempts: Number
    }
  },
  overallStats: {
    successRate: Number,
    totalAttempts: Number,
    totalAccepted: Number,
    uniqueProblems: Number,
    solvedProblems: Number
  },
  difficultyBreakdown: {
    easy: { attempts: Number, accepted: Number, rate: Number },
    medium: { attempts: Number, accepted: Number, rate: Number },
    hard: { attempts: Number, accepted: Number, rate: Number }
  },
  streakInfo: {
    currentStreak: Number,
    longestStreak: Number,
    lastActiveDate: Date
  },
  comparisonToPrevious: {
    successRateChange: Number,
    newProblemsSolved: Number,
    improvementScore: Number
  }
}, { timestamps: true });

progressSnapshotSchema.index({ userId: 1, createdAt: -1 });

progressSnapshotSchema.statics.createSnapshot = async function(userId, sessionId, diagnosis, submissions) {
  const normalizedUserId = userId.toLowerCase().trim();
  
  // Calculate topic stats from diagnosis
  const topicStats = new Map();
  if (diagnosis?.weak_topics) {
    for (const wt of diagnosis.weak_topics) {
      topicStats.set(wt.topic, {
        attempts: wt.submissions_count || 0,
        accepted: Math.round((wt.score / 100) * (wt.submissions_count || 0)),
        successRate: wt.score,
        avgAttempts: 1
      });
    }
  }

  // Get previous snapshot for comparison
  const prevSnapshot = await this.findOne({ userId: normalizedUserId })
    .sort({ createdAt: -1 })
    .lean();

  const successRate = diagnosis?.overall_success_rate || 0;
  const comparisonToPrevious = prevSnapshot ? {
    successRateChange: successRate - (prevSnapshot.overallStats?.successRate || 0),
    newProblemsSolved: (diagnosis?.total_problems || 0) - (prevSnapshot.overallStats?.uniqueProblems || 0),
    improvementScore: Math.round((successRate - (prevSnapshot.overallStats?.successRate || 0)) * 10) / 10
  } : null;

  return this.create({
    userId: normalizedUserId,
    sessionId,
    topicStats,
    overallStats: {
      successRate,
      totalAttempts: diagnosis?.total_submissions || 0,
      totalAccepted: Math.round((successRate / 100) * (diagnosis?.total_submissions || 0)),
      uniqueProblems: diagnosis?.total_problems || 0,
      solvedProblems: diagnosis?.total_problems || 0
    },
    comparisonToPrevious
  });
};

const ProgressSnapshot = mongoose.model('ProgressSnapshot', progressSnapshotSchema);

// ============================================
// ACTION MODEL
// ============================================

const actionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  actionType: {
    type: String,
    enum: ['practice_problems', 'review_topic', 'take_break', 'focus_weak_area', 'celebrate_progress', 'custom'],
    required: true
  },
  action: {
    type: String,
    required: true
  },
  description: String,
  suggestedProblems: [{
    title: String,
    titleSlug: String,
    difficulty: String,
    topic: String,
    url: String
  }],
  reason: String,
  priority: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'ignored', 'expired'],
    default: 'pending'
  },
  completedProblems: [String],
  feedback: {
    helpful: Boolean,
    comment: String,
    rating: Number
  },
  expiresAt: Date,
  completedAt: Date
}, { timestamps: true });

actionSchema.index({ userId: 1, status: 1 });
actionSchema.index({ userId: 1, createdAt: -1 });

actionSchema.statics.createFromNextAction = async function(userId, sessionId, nextAction) {
  if (!nextAction) return null;
  
  return this.create({
    userId: userId.toLowerCase().trim(),
    sessionId,
    actionType: nextAction.type || 'practice_problems',
    action: nextAction.action || nextAction.title || 'Complete recommended practice',
    description: nextAction.description || nextAction.reason,
    suggestedProblems: nextAction.problems || [],
    reason: nextAction.reason,
    priority: nextAction.priority || 1,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
};

const Action = mongoose.model('Action', actionSchema);

// ============================================
// EXPORTS
// ============================================

export {
  // Connection
  connectDB,
  disconnectDB,
  isDBConnected,
  
  // Models
  User,
  Session,
  Submission,
  AgentOutput,
  Goal,
  ProgressSnapshot,
  Action,
  
  // Helpers
  normalizeTopic,
  normalizeTopics
};
