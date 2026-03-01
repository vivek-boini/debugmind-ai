import React from 'react'

export default function AgentStatus({ state, user, confidence }){
  return (
    <div className="agentStatus" role="status" aria-live="polite">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="agentBadge">🚀 {state}</div>
        <div style={{display:'flex',flexDirection:'column'}}>
          <div className="agentUser">User: <strong style={{color:'white'}}>{user}</strong></div>
          {typeof confidence === 'number' && (
            <div style={{marginTop:6,fontSize:13,color:'var(--muted)'}}>
              Agent Confidence Model: <strong style={{color:'white'}}>{confidence}%</strong>
            </div>
          )}
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
        <div className="muted">Monitoring in progress</div>
        <div className="muted" style={{marginTop:6,fontSize:13}}>Adaptive rule-based reasoning engine active</div>
      </div>
    </div>
  )
}
