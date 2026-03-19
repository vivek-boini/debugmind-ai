# DebugMind AI – Personalized Coding Feedback System

DebugMind AI is an agentic learning mentor designed to transform how developers improve their coding performance. By extracting your LeetCode submissions, it analyzes code patterns, detects weaknesses, and provides targeted recommendations via a professional dashboard.

---

## 🚀 Architecture & Data Flow

**Architecture:**
Chrome Extension → Backend → Analysis Engine → Dashboard

**Data Flow:**
User clicks extract on LeetCode → Submissions fetched → Backend processes → UI shows insights

---

## ✨ Features

- **LeetCode submission extraction**
- **GraphQL integration**
- **Weakness detection**
- **Skill heatmap**
- **Recommendations**
- **Progress tracking**

---

## 🛠 Tech Stack

- **Frontend:** React, Tailwind CSS
- **Backend:** Node.js, Express
- **Extension:** Chrome Extension (Manifest V3)
- **AI Layer:** Rule-based + LLM (Grok API)

---

## ⚙️ Setup Instructions

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev # or npm start
```
*Creates the Express server listening on the configured port.*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Starts the Vite React dashboard.*

### 3. Extension Setup
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension/` folder from this project.
4. Navigate to `https://leetcode.com/submissions/` to see the "Extract My Submissions" button.

---

## 📸 Screenshots

*(Placeholders for images)*

- **Dashboard:** `![Dashboard Screenshot](assets/Dashboard.png)`
- **Extension Button:** `![Extension Screenshot](assets/home.png)`
- **Insights:** `![Insights Screenshot](assets/home.png)`

---

## ⚠️ Disclaimer

*This project extracts only user-authorized data for educational purposes and does not perform large-scale scraping or violate platform policies.*


---

## ⚙️ Setup Instructions

### 1. Backend
```bash
cd backend
npm install
node index.js
```
*Server runs on `http://localhost:4000`*

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
*App runs on `http://localhost:3000`*

### 3. Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` directory.
4. Go to LeetCode and look for the **"Extract AI Data"** button in the navbar.

---

## 📸 Screenshots

| Dashboard Overview | Extension Integration | Conceptual Insights |
| :--- | :--- | :--- |
| ![Dashboard](./assets/Dashboard.png) | ![Home](./assets/home.png) | (Dashboard showing detailed alerts) |

---

## 📌 Disclaimer

This project extracts only user-authorized data for educational purposes and does not perform large-scale scraping or violate platform policies. All extraction is triggered manually by the authenticated user.

---

*Built with ❤️ for better coding.*
