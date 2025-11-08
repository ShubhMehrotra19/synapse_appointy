// Background service worker for Synapse extension

// Token validation helper for extension
async function validateToken() {
  try {
    const result = await chrome.storage.sync.get(["synapse_token"]);
    if (!result.synapse_token) {
      return false;
    }

    // Get API URL from storage or use default
    const config = await chrome.storage.sync.get(["api_url"]);
    const apiUrl = config.api_url || "http://localhost:3000";

    // Validate token with backend
    const response = await fetch(`${apiUrl}/api/auth/validate`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${result.synapse_token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Token validation failed:", error);
    return false;
  }
}

// Validate token periodically (every 1/2 minutes)
const TOKEN_CHECK_INTERVAL = 30 * 1000;
setInterval(async () => {
  const isValid = await validateToken();
  if (!isValid) {
    // Clear invalid token
    chrome.storage.sync.remove(["synapse_token", "synapse_user"]);
  }
}, TOKEN_CHECK_INTERVAL);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveContent") {
    handleSaveContent(message.data, sender.tab)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  // Handle logout signalled from a webpage (content script)
  if (message.action === "remoteLogout") {
    // Clear auth keys from extension storage so popup and background reflect logout
    chrome.storage.sync.remove(["synapse_token", "synapse_user"], () => {
      console.log(
        "Remote logout received — cleared synapse_token and synapse_user from chrome.storage.sync"
      );
      sendResponse({ success: true });
    });
    return true; // indicate we will send async response
  }

  // Handle token validation check
  if (message.action === "validateToken") {
    validateToken()
      .then((isValid) => sendResponse({ success: true, isValid }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle saving content to backend
async function handleSaveContent(data, tab) {
  try {
    // Validate token first
    const isValid = await validateToken();
    if (!isValid) {
      throw new Error("Not authenticated or token expired");
    }

    // Get auth token
    const result = await chrome.storage.sync.get(["synapse_token"]);
    if (!result.synapse_token) {
      throw new Error("Not authenticated");
    }

    // Get API URL from storage or use default
    const config = await chrome.storage.sync.get(["api_url"]);
    const apiUrl = config.api_url || "http://localhost:3000";

    // Send to backend
    const response = await fetch(`${apiUrl}/api/content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${result.synapse_token}`,
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title,
        content: data.content,
        html: data.html,
        segmentType: data.segmentType,
        metadata: data.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save content");
    }

    return await response.json();
  } catch (error) {
    console.error("Error saving content:", error);
    throw error;
  }
}

// Listen for tab updates to check if user navigated to auth page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Check if this is the auth callback
    if (
      tab.url.includes("localhost:3000") &&
      tab.url.includes("auth-callback")
    ) {
      // Extract token from URL if needed
      const url = new URL(tab.url);
      const token = url.searchParams.get("token");
      if (token) {
        chrome.storage.sync.set({ synapse_token: token });
      }
    }
  }
});
