import React from 'react'

export default function Welcome({ url, setUrl, urlError, onAnalyze, loading }) {
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcomeCard">
        <h1 id="welcome-title">Agentic AI Learning Mentor</h1>
        <p className="lead">Personalized study guidance for algorithm mastery. Submit your LeetCode profile and get a prioritized plan with weak topics, evidence, goals, recommended problems, and a compact strategy.</p>

        <ul className="features">
          <li><strong>Targeted insights</strong> — ranked weak topics with confidence scores</li>
          <li><strong>Actionable plans</strong> — clear goals and recommended problems</li>
          <li><strong>Runs locally</strong> — no external services required</li>
        </ul>

        <form className="ctaRow" onSubmit={(e) => { e.preventDefault(); onAnalyze(); }} aria-label="Analyze LeetCode profile">
          <label htmlFor="profileUrl" className="srOnly">LeetCode profile URL</label>
          <input id="profileUrl" name="profileUrl" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://leetcode.com/u/your-username" aria-invalid={!!urlError} />
          <button type="submit" onClick={onAnalyze} disabled={loading || !!urlError} aria-disabled={loading || !!urlError}>{loading ? 'Analyzing…' : 'Analyze profile'}</button>
        </form>

        {urlError && <div className="error">{urlError}</div>}

        {loading && (
          <div className="loadingStatus" role="status" aria-live="polite">
            <div className="loaderDots"><span></span><span></span><span></span></div>
            <div className="loadingText">Analyzing submission patterns…</div>
          </div>
        )}

        <p className="hint">Ex: <em>https://leetcode.com/u/sample_user</em></p>
      </div>
    </section>
  )
}
