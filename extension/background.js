// Background service worker (MV3)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'send_extract') {
    // Forward payload to backend on port 4000
    (async () => {
      try {
        const res = await fetch('http://localhost:4000/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload)
        })
        const data = await res.json()
        sendResponse({ ok: res.ok, status: res.status, data })
      } catch (err) {
        console.error('Extraction failed:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true // indicate async
  }
})
