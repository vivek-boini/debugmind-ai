// LeetCode Code Extractor - Content Script

function injectButton() {
  if (document.getElementById('leetcode-extractor-btn')) return;

  const nav = document.querySelector('nav') || 
              document.querySelector('.nav-menu') || 
              document.querySelector('[role="navigation"]');
  
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'leetcode-extractor-btn';
  btn.innerText = 'Extract AI Data';
  btn.className = 'extract-btn-injected';
  
  btn.onclick = async () => {
    btn.innerText = 'Extracting...';
    btn.disabled = true;
    try {
      await extractAndSend();
      btn.innerText = 'Success!';
      setTimeout(() => {
        btn.innerText = 'Extract AI Data';
        btn.disabled = false;
      }, 3000);
    } catch (err) {
      console.error('[DebugMind] Final Error:', err);
      // More helpful error message for the user
      if (err.message.includes('Failed to fetch')) {
        alert('Extraction failed: Could not connect to the Backend server. Please ensure your backend is running on http://localhost:4000');
      } else {
        alert(`Extraction failed: ${err.message}`);
      }
      btn.innerText = 'Error!';
      setTimeout(() => {
        btn.innerText = 'Extract AI Data';
        btn.disabled = false;
      }, 3000);
    }
  };

  nav.appendChild(btn);
}

async function graphql(operationName, query, variables = {}) {
  const csrfToken = getCookie('csrftoken');
  console.log(`[DebugMind] Requesting LeetCode API: ${operationName}`);
  
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      body: JSON.stringify({ 
        operationName,
        query, 
        variables 
      }),
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LeetCode API HTTP ${res.status}: ${text}`);
    }
    
    const json = await res.json();
    if (json.errors) {
      throw new Error(`LeetCode GraphQL Error: ${json.errors[0].message}`);
    }
    return json;
  } catch (e) {
    if (e.message === 'Failed to fetch') {
      throw new Error(`Network error while calling LeetCode (${operationName}). Check your internet or ad-blocker.`);
    }
    throw e;
  }
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

async function extractAndSend() {
  // 1. Get Username
  const userRes = await graphql('user', `query user { userStatus { username } }`);
  const username = userRes?.data?.userStatus?.username;
  if (!username) throw new Error('Not logged in to LeetCode');

  console.log('[DebugMind] User identified:', username);

  // 2. Get Recent Submissions
  console.log('[DebugMind] Fetching submission list...');
  const globalSubRes = await graphql('submissionList', `
    query submissionList($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String) {
      submissionList(offset: $offset, limit: $limit, lastKey: $lastKey, questionSlug: $questionSlug) {
        submissions {
          id
          statusDisplay
          lang
          title
          titleSlug
          timestamp
        }
      }
    }`, { offset: 0, limit: 20 });

  const allSubmissions = globalSubRes?.data?.submissionList?.submissions || [];
  
  const problemsMap = new Map();
  for (const sub of allSubmissions) {
    if (!problemsMap.has(sub.titleSlug)) {
      if (problemsMap.size >= 5) continue;
      problemsMap.set(sub.titleSlug, []);
    }
    problemsMap.get(sub.titleSlug).push(sub);
  }

  const selectedSubmissions = Array.from(problemsMap.values()).flat();
  const detailedSubmissions = [];

  console.log(`[DebugMind] Extracting code for ${selectedSubmissions.length} submissions...`);

  // 3. Get Code for each selected submission
  for (const sub of selectedSubmissions) {
    try {
      const detailRes = await graphql('submissionDetails', `
        query submissionDetails($submissionId: Int!) {
          submissionDetails(submissionId: $submissionId) {
            code
            runtimeDisplay
            memoryDisplay
          }
        }`, { submissionId: parseInt(sub.id) });
      
      const details = detailRes?.data?.submissionDetails;
      
      detailedSubmissions.push({
        ...sub,
        code: details?.code || '',
        runtime: details?.runtimeDisplay,
        memory: details?.memoryDisplay
      });
      
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.warn(`[DebugMind] Skipping submission ${sub.id}:`, e.message);
    }
  }

  if (detailedSubmissions.length === 0) throw new Error('No submissions found to extract');

  console.log('[DebugMind] Sending data to Backend...');

  // 4. Send to backend via background script
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'send_extract',
      payload: { username, submissions: detailedSubmissions }
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Extension Error: ${chrome.runtime.lastError.message}`));
      } else if (response && response.ok) {
        console.log('[DebugMind] Backend success:', response.data);
        resolve(response.data);
      } else {
        reject(new Error(response?.error || 'Backend server unreachable or returned error'));
      }
    });
  });
}

const observer = new MutationObserver(injectButton);
observer.observe(document.body, { childList: true, subtree: true });
injectButton();
