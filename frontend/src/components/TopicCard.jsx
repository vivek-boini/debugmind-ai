import React from 'react'
import ProgressBar from './ProgressBar'

export default function TopicCard({ topic }) {
  return (
    <div className="topicCard">
      <div className="topicHeader">
        <div>
          <h4>{topic.topic}</h4>
          <div className="muted" style={{fontSize:12,marginTop:6}}>Goal: {topic.goal}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:13,color:'var(--muted)',marginBottom:6}}>Confidence</div>
          <div style={{fontWeight:700,fontSize:14}}>{topic.confidence}%</div>
        </div>
      </div>

      <ProgressBar value={topic.confidence} />

      <div className="evidence">
        <strong className="muted">Evidence</strong>
        <ul style={{marginTop:8}}>
          {topic.evidence.map((e,i) => (
            <li key={i} style={{marginBottom:8, lineHeight:1.5}}>• {e}</li>
          ))}
        </ul>
      </div>

      <div style={{marginTop:8}}>
        <div className="muted"><strong>Strategy:</strong> {topic.strategy}</div>
      </div>
    </div>
  )
}
