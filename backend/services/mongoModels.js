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
import crypto from 'crypto';
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
  codeHash: { type: String, required: true },  // STEP 2: Always required for dedup
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
  // Code hash for smart re-analysis detection
  codeHash: String,
  // LLM Analysis results (LLM-only - no fallback)
  analysis: {
    source: { type: String, enum: ['llm', 'none'], default: 'none' },
    finalScore: { type: Number, min: 0, max: 100 },
    timeComplexity: String,
    spaceComplexity: String,
    complexity: String,       // Combined complexity string from GROQ
    mistakes: [String],
    improvements: [String],
    patterns: [String],
    improvement: String,      // Single improvement suggestion from GROQ
    codeHash: String,         // Hash of code at time of analysis (for change detection)
    lastAnalyzedAt: Date
  }
}, { timestamps: true });

// PRIMARY UNIQUE KEY: userId + titleSlug (NOT problemId)
submissionSchema.index({ userId: 1, titleSlug: 1 }, { unique: true });
submissionSchema.index({ userId: 1, 'stats.isSolved': 1 });

// STEP 3: Unique indexes for strict dedup enforcement
submissionSchema.index(
  { userId: 1, titleSlug: 1, 'submissions.timestamp': 1 },
  { name: 'dedup_timestamp' }
);
submissionSchema.index(
  { userId: 1, 'submissions.codeHash': 1 },
  { name: 'dedup_codehash', sparse: true }
);

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
  
  // STEP 1 + STEP 5: ALWAYS generate codeHash — never allow undefined
  const codeStr = submissionData.code || '';
  const hashInput = codeStr.length > 0
    ? codeStr
    : `${titleSlug}|${submissionData.timestamp || ''}|${submissionData.status || submissionData.statusDisplay || ''}`;
  const codeHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  const submissionTimestamp = submissionData.timestamp
    ? new Date(submissionData.timestamp * 1000)
    : new Date();

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
    timestamp: submissionTimestamp,
    codeHash  // STEP 5: Always stored
  };

  // UPSERT by userId + titleSlug (NOT problemId)
  let doc = await this.findOne({ userId: normalizedUserId, titleSlug });
  
  if (!doc) {
    // Document does NOT exist → CREATE new
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
      submissions: [],
      codeHash
    });
  } else {
    // Document exists → PUSH new submission, UPDATE updatedAt
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
  // STEP 5: Dedup verification log
  console.log("[Dedup Check]", {
    title: submissionData.title,
    titleSlug,
    codeHash,
    existingSubs: doc.submissions.length
  });

  // STEP 2: STRONG DEDUP — check codeHash AND timestamp+status
  const isDuplicate = doc.submissions.some(s => {
    // 1. Same userId + titleSlug + timestamp (within same doc, so userId+titleSlug is implicit)
    if (s.timestamp?.getTime() === submissionTimestamp.getTime() && s.status === newEntry.status) return true;
    
    // 2. Same codeHash (exact same code or same fallback fingerprint)
    if (s.codeHash && s.codeHash === codeHash) return true;
    
    // 3. Legacy: exact code string match
    if (s.code && codeStr && s.code === codeStr && s.status === newEntry.status) return true;
    
    return false;
  });
  
  if (!isDuplicate) {
    doc.submissions.push(newEntry);
    // Store latest code hash on parent doc for LLM re-analysis detection
    if (codeStr.length > 0) doc.codeHash = codeHash;
  } else {
    doc._skippedDuplicate = true;
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

  let isNew = false;
  if (!isDuplicate) {
    isNew = true;
    await doc.save();
  }

  return { doc, isNew };
};

submissionSchema.statics.bulkAddSubmissions = async function(userId, submissions, sessionId) {
  const results = [];
  let newCount = 0;
  let skippedCount = 0;
  
  for (const sub of submissions) {
    try {
      const { doc, isNew } = await this.addSubmission(userId, sub, sessionId);
      if (isNew) {
        newCount++;
      } else {
        skippedCount++;
      }
      
      results.push({ success: true, problemId: doc ? doc.problemId : sub.title, isNew });
    } catch (error) {
      results.push({ success: false, problemId: sub.title, error: error.message });
    }
  }
  
  // STEP 4: Clear dedup logging
  console.log(`[Dedup] Skipped ${skippedCount} duplicates`);
  console.log(`[Insert] Stored ${newCount} new submissions`);
  
  return Object.assign(results, { newCount, skippedCount });
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
    'analysis.source': analysisData.source || 'llm',
    'analysis.mistakes': analysisData.mistakes || [],
    'analysis.patterns': analysisData.patterns || [],
    'analysis.complexity': analysisData.complexity || '',
    'analysis.improvement': analysisData.improvement || '',
    'analysis.lastAnalyzedAt': analysisData.lastAnalyzedAt || new Date()
  };
  // Step 2: Store code hash at time of analysis for change detection
  if (analysisData.codeHash) update['analysis.codeHash'] = analysisData.codeHash;

  // Also set legacy fields if provided
  if (analysisData.finalScore != null) update['analysis.finalScore'] = analysisData.finalScore;
  if (analysisData.timeComplexity) update['analysis.timeComplexity'] = analysisData.timeComplexity;
  if (analysisData.spaceComplexity) update['analysis.spaceComplexity'] = analysisData.spaceComplexity;
  if (analysisData.improvements) update['analysis.improvements'] = analysisData.improvements;
  
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
  diagnosis: mongoose.Schema.Types.Mixed,
  goals: [mongoose.Schema.Types.Mixed],
  plan: mongoose.Schema.Types.Mixed,
  monitoring: mongoose.Schema.Types.Mixed,
  progress: mongoose.Schema.Types.Mixed,
  adaptation: mongoose.Schema.Types.Mixed,
  // FIX: Store next_action and recommendations (were previously lost)
  next_action: mongoose.Schema.Types.Mixed,
  recommendations: [mongoose.Schema.Types.Mixed],
  // Aggregated LLM insights (populated during async pipeline)
  llmSummary: {
    commonMistakes: [String],
    weakPatterns: [String],
    improvementAreas: [String],
    analyzedCount: { type: Number, default: 0 },
    lastAnalyzedAt: Date
  },
  decisions: [{
    agent: String,
    decision: String,
    reason: String,
    confidence: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  // STEP 2: Metrics computed from submissions (for Progress Dashboard)
  metrics: {
    total_submissions: { type: Number, default: 0 },
    total_accepted: { type: Number, default: 0 },
    success_rate: { type: Number, default: 0 },
    overall_success_rate: { type: Number, default: 0 }
  },
  // STEP 2: Confidence history for chart rendering
  confidence_history: mongoose.Schema.Types.Mixed,
  // STEP 2: Strategy evolution tracking
  strategy_evolution: mongoose.Schema.Types.Mixed,
  processingTime: Number,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  }
}, { timestamps: true });

agentOutputSchema.index({ userId: 1, createdAt: -1 });
agentOutputSchema.index({ userId: 1, updatedAt: -1 });
agentOutputSchema.index({ sessionId: 1 });

/**
 * UPSERT agent output by userId + sessionId
 * On re-run (after LLM enrichment), overwrites previous output for same session
 */
agentOutputSchema.statics.createFromLoopResult = async function(userId, sessionId, loopResult) {
  const normalizedUserId = userId.toLowerCase().trim();
  const previousOutput = await this.findOne({ userId: normalizedUserId }).lean();

  // ============================================
  // BUILD RECOMMENDATIONS: plan problems + similar problems
  // ============================================

  // Step 1: Extract problems from plan structure, normalize titleSlug
  const planProblems = (loopResult.plan?.plan || []).flatMap(day =>
    (day.items || day.problems || []).map(item => {
      const base = typeof item === 'string' ? { title: item } : item;
      return {
        ...base,
        // Normalize: always have titleSlug
        titleSlug: base.titleSlug || base.slug || base.title?.toLowerCase().replace(/\s+/g, '-') || '',
        day: day.day,
        focus: day.focus || day.topic
      };
    })
  );

  // Step 2: Collect similar problems from Problem metadata (if available)
  let similarProblems = [];
  try {
    // Get titleSlugs from plan problems to look up similar problems
    const planSlugs = [...new Set(planProblems.map(p => p.titleSlug).filter(Boolean))];
    if (planSlugs.length > 0) {
      const Problem = mongoose.model('Problem');
      const problemDocs = await Problem.find({
        titleSlug: { $in: planSlugs }
      }).select('similarProblems').lean();

      for (const doc of problemDocs) {
        if (doc.similarProblems && doc.similarProblems.length > 0) {
          similarProblems.push(...doc.similarProblems.map(sp => ({
            title: sp.title,
            titleSlug: sp.titleSlug,
            difficulty: sp.difficulty?.toLowerCase() || 'medium',
            source: 'similar_problem',
            url: `https://leetcode.com/problems/${sp.titleSlug}/`
          })));
        }
      }
    }
  } catch (err) {
    // Non-fatal: similar problems are optional
    console.warn('[DB] Could not fetch similar problems (non-fatal):', err.message);
  }

  // Step 3: Merge plan problems + similar problems
  const allProblems = [...planProblems, ...similarProblems];

  // Step 4: Deduplicate using Map (strong composite key to avoid over-filtering)
  const uniqueMap = new Map();
  allProblems.forEach(item => {
    // Use titleSlug as primary key, fall back to slug, then title+pattern composite
    const key = (
      item.titleSlug ||
      item.slug ||
      item.problemId ||
      (item.title || '') + '_' + (item.pattern || '')
    ).toLowerCase().trim();
    if (key && !uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });
  let recommendations = Array.from(uniqueMap.values());

  console.log('[Recommendations] Plan:', planProblems.length, 'Similar:', similarProblems.length,
    'After dedup:', recommendations.length);

  // Step 5: Ensure minimum count — if dedup was too aggressive, relax
  if (recommendations.length < 5 && allProblems.length >= 5) {
    console.log('[Recommendations] ⚠️ Too few after dedup (' + recommendations.length + '), relaxing to', Math.min(allProblems.length, 10));
    // Use allProblems but still remove exact titleSlug duplicates only
    const lightDedup = new Map();
    allProblems.forEach(item => {
      const key = (item.titleSlug || item.slug || '').toLowerCase().trim();
      if (!key || !lightDedup.has(key)) {
        lightDedup.set(key || `fallback_${lightDedup.size}`, item);
      }
    });
    recommendations = Array.from(lightDedup.values());
  }

  // Cap at 10 max recommendations
  recommendations = recommendations.slice(0, 10);

  console.log('[Recommendations] Final count:', recommendations.length);

  const previousChart = previousOutput?.confidence_history?.chart_data?.datasets?.[0]?.data || [];
  const incomingChart = loopResult?.confidence_history?.chart_data?.datasets?.[0]?.data || [];
  const shouldAppendHistory = previousChart.length > incomingChart.length && incomingChart.length > 0;
  const mergedConfidenceHistory = shouldAppendHistory
    ? {
        ...(previousOutput?.confidence_history || {}),
        ...(loopResult?.confidence_history || {}),
        chart_data: {
          ...(previousOutput?.confidence_history?.chart_data || {}),
          ...(loopResult?.confidence_history?.chart_data || {}),
          datasets: [{
            ...(loopResult?.confidence_history?.chart_data?.datasets?.[0] || previousOutput?.confidence_history?.chart_data?.datasets?.[0] || {}),
            data: [...previousChart, ...incomingChart].slice(-30)
          }]
        }
      }
    : (loopResult?.confidence_history || previousOutput?.confidence_history || null);

  const data = {
    userId: normalizedUserId,
    sessionId,
    diagnosis: loopResult.diagnosis,
    goals: loopResult.goals,
    plan: loopResult.plan,
    monitoring: loopResult.monitoring,
    adaptation: loopResult.adaptation,
    progress: loopResult.progress,
    // FIX: Store next_action and recommendations
    next_action: loopResult.next_action || null,
    recommendations,
    llmSummary: loopResult.llmSummary || null,
    decisions: loopResult.decisions || [],
    // STEP 2: Save metrics, confidence_history, strategy_evolution
    metrics: loopResult.metrics || {},
    confidence_history: mergedConfidenceHistory,
    strategy_evolution: loopResult.strategy_evolution || null,
    status: 'completed',
    // STEP 2: ALWAYS generate fresh timestamp — prevents stale version rejection
    updatedAt: new Date()
  };

  console.log('[DB] Saving AgentOutput:', {
    goalsCount: loopResult.goals?.length,
    planDays: loopResult.plan?.plan?.length,
    recommendationsCount: recommendations.length,
    hasNextAction: !!loopResult.next_action,
    hasDiagnosis: !!loopResult.diagnosis,
    previousChartPoints: previousChart.length,
    incomingChartPoints: incomingChart.length,
    mergedChartPoints: mergedConfidenceHistory?.chart_data?.datasets?.[0]?.data?.length || 0,
    updatedAt: data.updatedAt.toISOString()
  });

  // Step 5: UPSERT by userId only — ensures single AgentOutput per user
  // Each new extract overwrites the previous, preventing stale empty docs
  return this.findOneAndUpdate(
    { userId: normalizedUserId },
    { $set: data },
    { new: true, upsert: true }
  );
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const snapshotData = {
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
  };

  // CREATE a new snapshot per extract (not upsert) for historical tracking
  const snapshot = await this.create(snapshotData);

  // Step 3: Cleanup — keep only last 20 snapshots per user to avoid DB bloat
  const keepIds = await this.find({ userId: normalizedUserId })
    .sort({ createdAt: -1 })
    .limit(20)
    .distinct('_id');

  if (keepIds.length >= 20) {
    const deleted = await this.deleteMany({
      userId: normalizedUserId,
      _id: { $nin: keepIds }
    });
    if (deleted.deletedCount > 0) {
      console.log(`[DB] Cleaned up ${deleted.deletedCount} old snapshots for ${normalizedUserId}`);
    }
  }

  return snapshot;
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
    enum: [
      'practice_problems', 'review_topic', 'take_break', 'focus_weak_area',
      'celebrate_progress', 'custom',
      // Planning agent phases / nextAction categories
      'foundation', 'practice', 'challenge', 'review',
      'improvement', 'focus_topic', 'increase_difficulty', 'revise', 'retry',
      // Adaptation-derived actions
      'learning', 'habit', 'maintenance', 'setup'
    ],
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
  
  // Convert string priority to number (schema expects Number)
  const priorityMap = { low: 1, medium: 2, high: 3, critical: 4 };
  const numericPriority = typeof nextAction.priority === 'string'
    ? (priorityMap[nextAction.priority] || 2)
    : (nextAction.priority || 1);

  return this.create({
    userId: userId.toLowerCase().trim(),
    sessionId,
    actionType: nextAction.type || nextAction.category || 'practice_problems',
    action: nextAction.action || nextAction.next_action || nextAction.title || 'Complete recommended practice',
    description: nextAction.description || nextAction.details || nextAction.reason,
    suggestedProblems: nextAction.problems || [],
    reason: nextAction.reason || nextAction.details,
    priority: numericPriority,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
};

const Action = mongoose.model('Action', actionSchema);

// ============================================
// PROBLEM MODEL (LeetCode problem metadata cache)
// ============================================

const problemSchema = new mongoose.Schema({
  titleSlug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  title: String,
  shortDescription: String,   // Plain text, max 500 chars (HTML stripped)
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'Unknown'],
    default: 'Unknown'
  },
  tags: [String],              // Normalized tag names
  examples: String,            // Example test cases (max 500 chars)
  constraints: String,         // Extracted constraints (max 300 chars)
  similarProblems: [{          // From LeetCode similarQuestions
    title: String,
    titleSlug: String,
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Unknown'], default: 'Unknown' }
  }],
  fetchedAt: Date
}, { timestamps: true });

const Problem = mongoose.model('Problem', problemSchema);

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
  Problem,
  
  // Helpers
  normalizeTopic,
  normalizeTopics
};
