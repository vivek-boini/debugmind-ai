# DebugMind AI Backend v2.2.0

Agentic AI Learning System with MongoDB persistence for LeetCode progress tracking.

## Features

- **Multi-Agent Pipeline**: Diagnosis, Goals, Planning, Monitoring, Adaptation
- **MongoDB Persistence**: Session history, progress tracking, submission analytics
- **User Authentication**: Email/password signup & JWT tokens
- **Backward Compatible**: Works with or without MongoDB (falls back to in-memory)

## Quick Start

```bash
cd backend
npm install
npm start
```

Server starts on `http://localhost:4000`

## MongoDB Setup

1. Install MongoDB locally or create an Atlas cluster
2. Copy `.env.example` to `.env`
3. Set `MONGODB_URI` to your connection string

```bash
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/debugmind

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/debugmind
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | No* | MongoDB connection string |
| `JWT_SECRET` | No* | Secret for JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 7d) |
| `NVIDIA_API_KEY` | Yes | NVIDIA API for LLM analysis |
| `PORT` | No | Server port (default: 4000) |

*System works without these but persistence/auth will be disabled

## API Endpoints

### Authentication
- `POST /signup` - Create account
- `POST /login` - Login with email/password
- `POST /guest-login` - Guest access with LeetCode username
- `GET /me` - Get current user info

### Core
- `POST /extract` - Process LeetCode submissions
- `GET /agent-state/:userId` - Get agent analysis state
- `POST /code-analysis` - Deep AI code analysis

### History (MongoDB)
- `GET /sessions/:userId` - Session history
- `GET /submission-history/:userId/:problemId` - Problem history
- `GET /user-stats/:userId` - Overall statistics
- `GET /progress-history/:userId` - Progress snapshots
- `GET /active-goals/:userId` - Current goals
- `GET /pending-actions/:userId` - Pending recommendations

### System
- `GET /health` - System status
- `GET /api-docs` - Full API documentation

## Database Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts & preferences |
| `sessions` | Raw extracted data (append-only) |
| `submissions` | Problem-level submission history |
| `agentoutputs` | Agent pipeline results |
| `goals` | Learning goals tracking |
| `progresssnapshots` | Progress over time |
| `actions` | Recommended actions |

## Architecture

```
Chrome Extension → POST /extract → Agent Pipeline → userCache (immediate)
                                                  ↓
                                           MongoDB (background)
```

Key design: MongoDB operations are NON-BLOCKING. The system responds immediately while persisting data in the background.
