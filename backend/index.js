const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

function extractUsername(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 2 && (parts[0] === 'u' || parts[0] === 'profile')) return parts[1]
    return parts[parts.length - 1] || 'sample_user'
  } catch (e) {
    return 'sample_user'
  }
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function generateResponse(user) {
  const pool = [
    {
      topic: 'Loop Invariants',
      base: 60,
      evidence: [
        'Loop range modified across multiple attempts',
        'Boundary condition toggled several times'
      ],
      goal: 'Increase mastery to 80%',
      strategy: 'Assign boundary-isolation problems'
    },
    {
      topic: 'Recursion Base Case',
      base: 45,
      evidence: ['Base case edited in consecutive attempts'],
      goal: 'Increase mastery to 75%',
      strategy: 'Practice simple recursion depth problems'
    },
    {
      topic: 'Two-pointer Techniques',
      base: 50,
      evidence: ['Pointers reset between trials', 'Off-by-one corrections observed'],
      goal: 'Increase mastery to 78%',
      strategy: 'Assign sliding-window and two-pointer drills'
    },
    {
      topic: 'Tree Traversal',
      base: 55,
      evidence: ['Traversal order changed', 'Null-checks overlooked'],
      goal: 'Increase mastery to 80%',
      strategy: 'Practice traversal and recursion patterns'
    }
  ]

  const problems = [
    'Remove Duplicates from Sorted Array',
    'Valid Parentheses',
    'Maximum Subarray',
    'Binary Tree Depth',
    'Two Sum',
    'Merge Intervals'
  ]

  const h = hashStr(user || 'sample_user')
  const first = pool[h % pool.length]
  const second = pool[(h + 3) % pool.length]

  function makeTopic(tpl, offset) {
    const variance = (h >>> offset) % 15
    const sign = ((h >>> (offset + 4)) % 2) ? 1 : -1
    const confidence = Math.max(20, Math.min(95, tpl.base + sign * variance))
    const evidence = tpl.evidence.map((e, i) => {
      return e + (i === 0 ? '' : '')
    })
    return {
      topic: tpl.topic,
      confidence,
      evidence,
      goal: tpl.goal,
      strategy: tpl.strategy
    }
  }

  const weak_topics = [makeTopic(first, 2), makeTopic(second, 6)]

  const start = h % problems.length
  const recommended_problems = []
  for (let i = 0; i < 4; i++) recommended_problems.push(problems[(start + i) % problems.length])

  return {
    user: user || 'sample_user',
    agent_state: 'Active - Goal Planning',
    weak_topics,
    recommended_problems
  }
}

app.post('/analyze', (req, res) => {
  const { profileUrl } = req.body || {}
  const user = extractUsername(profileUrl || '')
  const response = generateResponse(user)
  setTimeout(() => res.json(response), 600)
})

app.listen(port, () => {
  console.log(`Mentor backend listening at http://localhost:${port}`)
})
