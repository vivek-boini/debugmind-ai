// Background service worker (MV3)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'send_extract') {
    // Forward payload to backend on port 4000
    (async () => {
      try {
        // Step 1: Send to /extract endpoint
        const res = await fetch('http://localhost:4000/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload)
        })
        const data = await res.json()

        if (res.ok) {
          // Step 2: Auto-trigger code analysis after successful extraction
          try {
            console.log('[DebugMind] Triggering code analysis...')
            const analysisRes = await fetch('http://localhost:4000/code-analysis', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: msg.payload.username,
                submissions: msg.payload.submissions
              })
            })
            
            if (analysisRes.ok) {
              const analysisData = await analysisRes.json()
              console.log('[DebugMind] Code analysis complete')
              
              // Store analysis in chrome.storage.local
              const storageKey = `debugmind_codeanalysis_${msg.payload.username.toLowerCase()}`
              chrome.storage.local.set({ [storageKey]: analysisData }, () => {
                console.log('[DebugMind] Analysis cached in storage')
              })
            } else {
              console.warn('[DebugMind] Code analysis failed:', await analysisRes.text())
            }
          } catch (analysisErr) {
            console.warn('[DebugMind] Code analysis error:', analysisErr.message)
            // Don't fail the whole operation if analysis fails
          }
        }

        sendResponse({ ok: res.ok, status: res.status, data })
      } catch (err) {
        console.error('Extraction failed:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true // indicate async
  }

  // Handle request to get cached analysis
  if (msg && msg.type === 'get_analysis') {
    const storageKey = `debugmind_codeanalysis_${msg.username.toLowerCase()}`
    chrome.storage.local.get([storageKey], (result) => {
      sendResponse({ ok: true, data: result[storageKey] || null })
    })
    return true // indicate async
  }
})
