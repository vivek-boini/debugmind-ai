import React, { useState } from 'react'
import TopicCard from './components/TopicCard'
import AgentStatus from './components/AgentStatus'
import Welcome from './components/Welcome'

export default function App() {
  const [url, setUrl] = useState('https://leetcode.com/u/sample_user')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [urlError, setUrlError] = useState(null)

  const analyze = async () => {
    if (urlError) {
      setError('Please fix the profile URL before analyzing.')
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('http://localhost:4000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl: url })
      })
      if (!res.ok) throw new Error('Server error')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function validateUrl(value) {
    try {
      const u = new URL(value)
      if (!u.hostname.includes('leetcode.com')) return 'URL must be a leetcode.com profile'
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length < 1) return 'Profile URL appears invalid'
      return null
    } catch (e) {
      return 'Enter a valid URL (e.g. https://leetcode.com/u/username)'
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Agentic AI Learning Mentor</h1>
        <p className="sub">MVP — AI outputs</p>
      </header>

      <main className="container">
        {!data && (
          <Welcome url={url} setUrl={(v) => { setUrl(v); setUrlError(validateUrl(v)); }} urlError={urlError} onAnalyze={analyze} loading={loading} />
        )}

        {data && (
          <>
            <section className="controls card">
              {data && <AgentStatus state={data.agent_state} user={data.user} confidence={Math.round(data.weak_topics.reduce((s,t)=>s+t.confidence,0)/data.weak_topics.length)} />}
            </section>

            <section className="dashboard">
              <div className="left">
                <h2>Weak Topics</h2>
                <div className="grid">
                  {data.weak_topics.map((t) => (
                    <TopicCard key={t.topic} topic={t} />
                  ))}
                </div>

                <h2>Recommended Problems</h2>
                <div className="card list">
                  {data.recommended_problems.map((p) => (
                    <div key={p} className="problem">{p}</div>
                  ))}
                </div>
              </div>

              <aside className="right">
                <div className="card summary">
                  <h3>Strategy Summary</h3>
                  <p>{data.weak_topics.map(t => t.strategy).join('; ')}</p>
                </div>

                <div className="card timeline">
                  <h3>Agent Timeline</h3>
                  <ol>
                    <li>Goal set: Improve weak topics</li>
                    <li>Assigning practice problems</li>
                    <li>Monitoring in progress</li>
                  </ol>
                </div>
              </aside>
            </section>
          </>
        )}

      </main>

      <footer className="footer">
        <small>Dark theme • JSON</small>
      </footer>
    </div>
  )
}
