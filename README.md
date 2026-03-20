# DebugMind AI – Agentic Learning Mentor System

DebugMind AI is an **agentic AI learning system** that transforms how developers improve their coding performance. It features a closed-loop autonomous agent architecture that extracts LeetCode submissions, diagnoses weaknesses, sets personalized goals, creates adaptive learning plans, monitors progress, and continuously adapts strategies based on performance.

**Version 2.1** | Featuring full explainability, decision logging, and strategy evolution tracking.

---

## 🤖 Agent Architecture

DebugMind AI operates as a **multi-agent system** with specialized agents working in a coordinated loop:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT LOOP                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ EXTRACT  │───▶│ DIAGNOSE │───▶│   GOAL   │───▶│   PLAN   │      │
│  │  Agent   │    │  Agent   │    │  Agent   │    │  Agent   │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│       ▲                                               │             │
│       │                                               ▼             │
│  ┌──────────┐                                   ┌──────────┐        │
│  │  ADAPT   │◀──────────────────────────────────│ MONITOR  │        │
│  │  Agent   │                                   │  Agent   │        │
│  └──────────┘                                   └──────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Descriptions

| Agent | Responsibility | Input | Output |
|-------|---------------|-------|--------|
| **Diagnosis Agent** | Analyzes submissions to identify weak topics | Raw submissions | Weak topics with confidence scores |
| **Goal Agent** | Sets personalized, achievable learning goals | Diagnosis + metrics | SMART goals with milestones |
| **Planning Agent** | Creates day-by-day learning plans | Goals + problem database | Structured daily plans |
| **Monitoring Agent** | Tracks progress and detects trends | New submissions + previous state | Progress metrics, trend analysis |
| **Adaptation Agent** | Adjusts strategy based on performance | Monitoring results | Strategy modifications, alerts |

### Agent Orchestrator

The **Agent Orchestrator** (`services/agentOrchestrator.js`) coordinates all agents:
- Manages agent execution order
- Handles state transitions
- Logs all decisions for explainability
- Tracks confidence scores over time
- Generates next actions and smart alerts

---

## 🧠 Explainability System

Every decision made by the AI is fully transparent and explainable:

### Decision Logging
```javascript
{
  agent: "diagnosis",
  decision: "Identified 'Dynamic Programming' as weak topic",
  reason: "Success rate of 35% across 12 attempts, below 50% threshold",
  confidence: 0.85,
  evidence: ["Failed: Climbing Stairs", "Failed: Coin Change", ...],
  human_readable: "Based on 12 Dynamic Programming attempts with only 35% success..."
}
```

### Confidence Tracking
- Tracks confidence scores per topic over time
- Visualizes trends (improving, declining, stable)
- Provides chart data for frontend visualization

### Strategy Evolution
```
BEFORE: Focus on easy problems across all topics
  ↓ (Trigger: Success rate dropped below 40%)
AFTER:  Intensive DP drills with pattern recognition focus
```

### Smart Alerts
- **Critical**: Performance dropping significantly
- **Warning**: Behind on goals, declining trends
- **Info**: Suggestions for improvement
- **Success**: Goals achieved, milestones reached

---

## 🚀 Data Flow Diagram

```
┌─────────────────┐
│  Chrome         │
│  Extension      │
│  (LeetCode)     │
└────────┬────────┘
         │ Extract submissions
         ▼
┌─────────────────┐     ┌─────────────────────────────────────────┐
│  POST /extract  │────▶│            AGENT ORCHESTRATOR           │
└─────────────────┘     │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
                        │  │Diagnosis│─▶│  Goals  │─▶│Planning │  │
                        │  └─────────┘  └─────────┘  └─────────┘  │
                        │        │            │            │       │
                        │        ▼            ▼            ▼       │
                        │  ┌─────────────────────────────────────┐ │
                        │  │         MEMORY STORE                │ │
                        │  │  (State, History, Metrics)          │ │
                        │  └─────────────────────────────────────┘ │
                        │        │                                 │
                        │        ▼                                 │
                        │  ┌─────────┐  ┌─────────┐               │
                        │  │ Monitor │─▶│  Adapt  │               │
                        │  └─────────┘  └─────────┘               │
                        │        │                                 │
                        │        ▼                                 │
                        │  ┌─────────────────────────────────────┐ │
                        │  │    EXPLAINABILITY LAYER             │ │
                        │  │  • Decision Logs                    │ │
                        │  │  • Confidence Tracking              │ │
                        │  │  • Next Action Generator            │ │
                        │  │  • Smart Alerts                     │ │
                        │  └─────────────────────────────────────┘ │
                        └──────────────────┬──────────────────────┘
                                           │
                                           ▼
                        ┌─────────────────────────────────────────┐
                        │           REACT DASHBOARD               │
                        │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
                        │  │ Agent   │ │Insights │ │ Progress  │  │
                        │  │ Status  │ │  Panel  │ │  Charts   │  │
                        │  └─────────┘ └─────────┘ └───────────┘  │
                        │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
                        │  │ Smart   │ │Strategy │ │ Decision  │  │
                        │  │ Alerts  │ │Evolution│ │ Timeline  │  │
                        │  └─────────┘ └─────────┘ └───────────┘  │
                        └─────────────────────────────────────────┘
```

---

## ✨ Features

### Core Features
- **LeetCode submission extraction** via Chrome Extension
- **Automated weakness detection** with topic classification
- **Personalized goal setting** with SMART criteria
- **Adaptive learning plans** that adjust to progress

### Agentic Features (v2.0+)
- **Closed-loop agent system** with 5 specialized agents
- **Continuous adaptation** based on performance trends
- **Progress monitoring** with trend detection
- **Smart recommendations** for next actions

### Explainability Features (v2.1+)
- **Decision logging** with full transparency
- **Confidence tracking** over time with visualizations
- **Strategy evolution** showing before/after adaptations
- **Smart alerts** with contextual suggestions
- **Decision timeline** for agent activity review

---

## 🛠 Tech Stack

- **Frontend:** React 18, Tailwind CSS, Custom SVG Charts
- **Backend:** Node.js, Express, In-memory State Store
- **Extension:** Chrome Extension (Manifest V3)
- **AI Layer:** Multi-agent architecture with rule-based reasoning
- **Explainability:** Custom logging, confidence tracking, alert system

---

## 📁 Project Structure

```
DebugMind AI/
├── backend/
│   ├── agents/                    # Specialized AI agents
│   │   ├── index.js              # Agent exports
│   │   ├── diagnosisAgent.js     # Weakness detection
│   │   ├── goalAgent.js          # Goal setting
│   │   ├── planningAgent.js      # Plan generation
│   │   ├── monitoringAgent.js    # Progress tracking
│   │   └── adaptationAgent.js    # Strategy adaptation
│   ├── services/                  # Core services
│   │   ├── index.js              # Service exports
│   │   ├── agentOrchestrator.js  # Agent coordination
│   │   ├── memoryStore.js        # State management
│   │   ├── agentLogger.js        # Decision logging
│   │   ├── confidenceTracker.js  # Confidence tracking
│   │   └── nextActionGenerator.js # Action & alerts
│   └── index.js                   # Express server & routes
├── frontend/
│   └── src/
│       └── App.jsx               # React dashboard
├── extension/                     # Chrome extension
│   ├── manifest.json
│   ├── content.js
│   └── popup.html
└── README.md
```

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/extract` | Extract submissions and run full agent loop |
| POST | `/analyze` | Get dashboard-ready analysis data |
| POST | `/update-progress` | Submit new data for incremental update |

### Agent State Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agent-state/:userId` | Get full agent state with explainability |
| GET | `/goals/:userId` | Get learning goals |
| GET | `/plan/:userId` | Get current learning plan |
| GET | `/progress/:userId` | Get progress history and metrics |
| GET | `/adaptation/:userId` | Get adaptation state and history |

### Explainability Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agent-logs/:userId` | Get agent decision logs |
| GET | `/confidence-history/:userId` | Get confidence evolution data |
| GET | `/next-action/:userId` | Get recommended next action |
| GET | `/strategy-evolution/:userId` | Get strategy changes |
| GET | `/alerts/:userId` | Get smart alerts |

### Control Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/trigger-agent` | Manually trigger a specific agent |
| POST | `/re-diagnose/:userId` | Force re-diagnosis |
| POST | `/plan/:userId/advance` | Advance to next day in plan |

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/api-docs` | API documentation |

---

## ⚙️ Setup Instructions

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev # or npm start
```
*Server starts at http://localhost:4000*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Dashboard available at http://localhost:5173*

### 3. Extension Setup
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top right
3. Click **Load unpacked** and select the `extension/` folder
4. Navigate to `https://leetcode.com/submissions/`
5. Click "Extract My Submissions" button

---

## 📸 Screenshots

### Dashboard Views

| View | Description |
|------|-------------|
| ![Dashboard](./assets/Dashboard.png) | **Main Dashboard** - Overview with weak topics, recommendations, and agent status |
| ![Recommendations](./assets/Recomendation.png) | **Recommendations Panel** - Personalized problem suggestions |

### Agentic Features (v2.1)

| Feature | Description |
|---------|-------------|
| **Agent Loop Indicator** | Visual display of current agent stage (Extract → Diagnose → Goal → Plan → Monitor → Adapt) |
| **Smart Alerts** | Contextual alerts with priority levels (critical, warning, info, success) |
| **Next Action Card** | Prominent display of recommended next step with priority badge |
| **Strategy Evolution** | Before/after comparison showing how strategy adapted |
| **Decision Timeline** | Chronological log of agent decisions with explanations |
| **Confidence Charts** | Visual tracking of topic confidence over time |

---

## 🔄 Agent Loop in Action

```
1. USER extracts submissions from LeetCode
                    ↓
2. DIAGNOSIS AGENT analyzes patterns
   → Identifies weak topics (e.g., "Dynamic Programming: 35% success")
                    ↓
3. GOAL AGENT sets targets
   → Creates SMART goals (e.g., "Reach 60% DP success in 14 days")
                    ↓
4. PLANNING AGENT creates schedule
   → Generates daily plan with specific problems
                    ↓
5. USER practices according to plan
                    ↓
6. MONITORING AGENT tracks progress
   → Detects trends, calculates metrics
                    ↓
7. ADAPTATION AGENT adjusts strategy
   → Modifies plan based on performance
                    ↓
         ↺ Loop continues...
```

---

## 📌 Disclaimer

This project extracts only user-authorized data for educational purposes and does not perform large-scale scraping or violate platform policies. All extraction is triggered manually by the authenticated user.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## 📄 License

MIT License - See LICENSE file for details.

---

*Built with ❤️ for better coding | DebugMind AI v2.1*
