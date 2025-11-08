// Validate stored token
async function validateStoredToken() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "validateToken" }, (response) => {
      if (response?.success && response?.isValid) {
        resolve(true);
      } else {
        // Clear invalid token
        chrome.storage.sync.remove(["synapse_token", "synapse_user"]);
        resolve(false);
      }
    });
  });
}

// Sync auth from open Synapse tabs
async function syncAuthFromTabs() {
  try {
    // First check if we have a valid token
    const isValid = await validateStoredToken();
    if (isValid) {
      return true;
    }

    // If token is invalid, try to get new one from tabs
    const allTabs = await chrome.tabs.query({});
    const synapseTabs = allTabs.filter(
      (tab) =>
        tab.url &&
        (tab.url.includes("localhost:3000") ||
          tab.url.includes("127.0.0.1:3000"))
    );

    // If no synapse tabs found, return false
    if (synapseTabs.length === 0) {
      return false;
    }

    // Try each Synapse tab
    for (const tab of synapseTabs) {
      try {
        // Try to get token from localStorage
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              return {
                token: localStorage.getItem("synapse_token"),
                user: localStorage.getItem("synapse_user"),
              };
            } catch (e) {
              return { token: null, user: null };
            }
          },
        });

        if (results && results[0] && results[0].result) {
          const { token, user } = results[0].result;
          if (token && user) {
            await chrome.storage.sync.set({
              synapse_token: token,
              synapse_user: JSON.parse(user),
            });
            return true; // Successfully synced
          }
        }
      } catch (error) {
        // Tab might not be accessible (e.g., chrome:// pages), continue to next tab
        console.log("Could not access tab:", tab.id, error.message);
        continue;
      }
    }
    return false; // No auth found
  } catch (error) {
    console.error("Error syncing auth:", error);
    return false;
  }
}

// Check authentication status
async function checkAuth() {
  // First check storage
  const result = await chrome.storage.sync.get([
    "synapse_token",
    "synapse_user",
  ]);
  let isAuthenticated = result.synapse_token && result.synapse_user;

  // If not authenticated, try to sync from open tabs
  if (!isAuthenticated) {
    const synced = await syncAuthFromTabs();
    if (synced) {
      // Re-check after sync
      const newResult = await chrome.storage.sync.get([
        "synapse_token",
        "synapse_user",
      ]);
      isAuthenticated = newResult.synapse_token && newResult.synapse_user;
    }
  }

  const statusText = document.getElementById("status-text");
  const loginSection = document.getElementById("login-section");
  const mainSection = document.getElementById("main-section");
  const authStatus = document.getElementById("auth-status");

  if (isAuthenticated) {
    statusText.textContent = "Connected";
    authStatus.className = "auth-status authenticated";
    loginSection.classList.add("hidden");
    mainSection.classList.remove("hidden");
  } else {
    statusText.textContent = "Not Connected";
    authStatus.className = "auth-status unauthenticated";
    loginSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
  }
}

// Open Synapse web app
document.getElementById("open-login")?.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:3000/login" }, (tab) => {
    // Listen for tab updates to sync auth when user logs in
    const listener = (tabId, changeInfo, updatedTab) => {
      if (tabId === tab.id && changeInfo.status === "complete") {
        if (
          updatedTab.url &&
          (updatedTab.url.includes("auth-callback") ||
            updatedTab.url.includes("dashboard"))
        ) {
          // Small delay to ensure localStorage is set
          setTimeout(() => {
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id },
                func: () => {
                  return {
                    token: localStorage.getItem("synapse_token"),
                    user: localStorage.getItem("synapse_user"),
                  };
                },
              },
              (results) => {
                if (results && results[0] && results[0].result) {
                  const { token, user } = results[0].result;
                  if (token && user) {
                    chrome.storage.sync.set(
                      {
                        synapse_token: token,
                        synapse_user: JSON.parse(user),
                      },
                      () => {
                        checkAuth();
                      }
                    );
                  }
                }
                chrome.tabs.onUpdated.removeListener(listener);
              }
            );
          }, 500);
        }
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
});

// Sync auth button
document.getElementById("sync-auth")?.addEventListener("click", async () => {
  const statusText = document.getElementById("status-text");
  const originalText = statusText.textContent;
  statusText.textContent = "Syncing...";

  const synced = await syncAuthFromTabs();

  if (synced) {
    statusText.textContent = "Synced!";
    setTimeout(() => {
      checkAuth();
    }, 500);
  } else {
    statusText.textContent = "No auth found. Please log in first.";
    setTimeout(() => {
      statusText.textContent = originalText;
    }, 2000);
  }
});

// Helper function to check if content script is loaded
async function isContentScriptLoaded(tabId) {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: "ping" }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 300)
      ),
    ]);
    return response && response.pong === true;
  } catch (e) {
    return false;
  }
}

// Helper function to inject and verify content script
async function ensureContentScript(tabId) {
  // Try multiple times with exponential backoff
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check if already loaded
      if (await isContentScriptLoaded(tabId)) {
        return true;
      }

      // Inject the script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });

      // Wait with exponential backoff
      const waitTime = 300 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Verify it loaded
      if (await isContentScriptLoaded(tabId)) {
        return true;
      }
    } catch (injectError) {
      console.error(`Injection attempt ${attempt + 1} failed:`, injectError);
      if (attempt === maxAttempts - 1) {
        throw injectError;
      }
    }
  }

  return false;
}

// Capture page button
document.getElementById("capture-btn")?.addEventListener("click", async () => {
  const statusMessage = document.getElementById("status-message");
  const captureBtn = document.getElementById("capture-btn");

  try {
    captureBtn.disabled = true;
    statusMessage.textContent = "Preparing capture...";
    statusMessage.className = "status-message info";

    // Get current tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Check if we can access this tab
    if (
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("chrome-extension://")
    ) {
      throw new Error("Cannot capture content from this page type");
    }

    // Ensure content script is loaded and ready
    statusMessage.textContent = "Loading content script...";
    const scriptLoaded = await ensureContentScript(tab.id);

    if (!scriptLoaded) {
      throw new Error(
        "Failed to load content script. Please refresh the page and try again."
      );
    }

    // Send message to content script to start capture mode
    statusMessage.textContent = "Starting capture mode...";
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { action: "startCapture" }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      ),
    ]);

    if (response && response.success) {
      statusMessage.textContent = "Click on the page to select content...";
      statusMessage.className = "status-message info";
      // Close popup so user can interact with page
      setTimeout(() => window.close(), 500);
    } else {
      throw new Error("Failed to start capture mode");
    }
  } catch (error) {
    console.error("Error:", error);
    let errorMsg = error.message;

    if (errorMsg.includes("Receiving end does not exist")) {
      errorMsg =
        "Content script not loaded. Please refresh the page and try again.";
    } else if (errorMsg.includes("Timeout")) {
      errorMsg =
        "Content script did not respond. Please refresh the page and try again.";
    }

    statusMessage.textContent = "Error: " + errorMsg;
    statusMessage.className = "status-message error";
    captureBtn.disabled = false;
  }
});

// Initialize
checkAuth();

// Listen for auth changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && (changes.synapse_token || changes.synapse_user)) {
    checkAuth();
  }
});
