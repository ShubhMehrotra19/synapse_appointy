// Background service worker for Synapse extension

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveContent') {
    handleSaveContent(message.data, sender.tab)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Handle saving content to backend
async function handleSaveContent(data, tab) {
  try {
    // Get auth token
    const result = await chrome.storage.sync.get(['synapse_token']);
    if (!result.synapse_token) {
      throw new Error('Not authenticated');
    }
    
    // Get API URL from storage or use default
    const config = await chrome.storage.sync.get(['api_url']);
    const apiUrl = config.api_url || 'http://localhost:3000';
    
    // Send to backend
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.synapse_token}`
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title,
        content: data.content,
        html: data.html,
        segmentType: data.segmentType,
        metadata: data.metadata
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save content');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving content:', error);
    throw error;
  }
}

// Listen for tab updates to check if user navigated to auth page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this is the auth callback
    if (tab.url.includes('localhost:3000') && tab.url.includes('auth-callback')) {
      // Extract token from URL if needed
      const url = new URL(tab.url);
      const token = url.searchParams.get('token');
      if (token) {
        chrome.storage.sync.set({ synapse_token: token });
      }
    }
  }
});

