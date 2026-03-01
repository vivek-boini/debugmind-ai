import React from 'react'

export default function ProgressBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{flex:1}}>
          <div className="progressOuter">
            <div className="progressInner" style={{width:`${pct}%`}} />
          </div>
        </div>
        <div style={{width:46,textAlign:'right',fontWeight:600}}>{pct}%</div>
      </div>
    </div>
  )
}
