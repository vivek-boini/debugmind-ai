document.getElementById('openSub').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://leetcode.com/submissions/' });
});

document.getElementById('trigger').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.url.includes('leetcode.com')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const btn = document.getElementById('leetcode-extractor-btn');
        if (btn) btn.click();
        else alert('Extraction button not found. Please refresh the page.');
      }
    });
  } else {
    alert('Please go to leetcode.com first.');
  }
});
