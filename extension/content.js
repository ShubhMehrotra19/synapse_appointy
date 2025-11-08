// Content script for Synapse extension

let captureMode = false;
let selectedElement = null;
let overlay = null;

// Set up message listener immediately when script loads
(function () {
  "use strict";

  // Remove any existing listener to avoid duplicates
  if (chrome.runtime.onMessage.hasListeners) {
    // This is a workaround - we'll just set up the listener
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle ping for checking if script is loaded
    if (message && message.action === "ping") {
      sendResponse({ pong: true });
      return false;
    }

    // Handle start capture
    if (message && message.action === "startCapture") {
      try {
        startCaptureMode();
        // Send response
        sendResponse({ success: true });
        return true; // Keep channel open for async response
      } catch (error) {
        console.error("Error starting capture:", error);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    return false;
  });

  // Log that script is loaded
  console.log("Synapse content script loaded and ready");
})();

// Listen for cross-window localStorage changes (e.g., logout from webapp dashboard)
// When the webapp removes the `synapse_token` key, other pages of the same origin
// receive a storage event; forward that to the extension background so it can
// clear the extension's stored auth state as well.
window.addEventListener("storage", (e) => {
  try {
    if (!e) return;
    // React only to the synapse_token key being removed/cleared
    if (e.key === "synapse_token") {
      // e.newValue will be null when removed
      if (e.newValue === null) {
        // Notify background to clear extension storage
        chrome.runtime.sendMessage({ action: "remoteLogout" }, (resp) => {
          // optional callback
          // console.log('remoteLogout sent, response:', resp);
        });
      }
    }
  } catch (err) {
    console.error("Error handling storage event in content script:", err);
  }
});

// Also listen for direct window messages posted by the webapp (this captures
// the logout event in the same tab where the app invoked window.postMessage).
window.addEventListener("message", (ev) => {
  try {
    if (!ev || !ev.data) return;
    if (ev.data && ev.data.type === "synapse:logout") {
      // Notify background to clear extension storage
      chrome.runtime.sendMessage({ action: "remoteLogout" }, (resp) => {
        // optional callback
      });
    }
  } catch (err) {
    console.error("Error handling window message in content script:", err);
  }
});

// Start capture mode
function startCaptureMode() {
  if (captureMode) return;

  captureMode = true;
  createOverlay();
  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleEscape);

  // Show instruction
  showNotification("Click on any element to capture it. Press ESC to cancel.");
}

// Create overlay for visual feedback
function createOverlay() {
  overlay = document.createElement("div");
  overlay.id = "synapse-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999998;
    pointer-events: none;
    background: rgba(99, 102, 241, 0.1);
  `;
  document.body.appendChild(overlay);
}

// Handle mouse over to highlight elements
function handleMouseOver(e) {
  if (!captureMode) return;

  e.stopPropagation();
  const element = e.target;

  if (
    element.id === "synapse-overlay" ||
    element.id === "synapse-notification"
  ) {
    return;
  }

  selectedElement = element;
  highlightElement(element);
}

// Highlight element
function highlightElement(element) {
  const rect = element.getBoundingClientRect();
  const highlight = document.getElementById("synapse-highlight");

  if (highlight) {
    highlight.remove();
  }

  const highlightDiv = document.createElement("div");
  highlightDiv.id = "synapse-highlight";
  highlightDiv.style.cssText = `
    position: fixed;
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid #6366f1;
    background: rgba(99, 102, 241, 0.2);
    pointer-events: none;
    z-index: 999999;
    box-sizing: border-box;
  `;
  document.body.appendChild(highlightDiv);
}

// Handle click to capture
async function handleClick(e) {
  if (!captureMode) return;

  e.preventDefault();
  e.stopPropagation();

  const element = e.target;

  if (
    element.id === "synapse-overlay" ||
    element.id === "synapse-notification"
  ) {
    return;
  }

  stopCaptureMode();

  try {
    showNotification("Analyzing content with AI...");

    // Extract content with images
    const content = await extractContent(element);

    // Categorize with AI
    const segmentType = await categorizeContent(content);

    // Save to backend with images
    await saveContent(element, content, segmentType);

    showNotification("Content captured successfully!", "success");

    // Notify popup
    chrome.runtime.sendMessage({
      action: "captureComplete",
      success: true,
    });
  } catch (error) {
    console.error("Error capturing content:", error);
    showNotification("Error: " + error.message, "error");

    chrome.runtime.sendMessage({
      action: "captureComplete",
      success: false,
      error: error.message,
    });
  }
}

// Extract content from element
async function extractContent(element) {
  // Get text content
  const text = element.innerText || element.textContent || "";

  // Get and convert images to base64
  const images = await Promise.all(
    Array.from(element.querySelectorAll("img")).map(async (img) => {
      try {
        const dataUrl = await getImageAsBase64(img.src);
        return {
          src: img.src,
          alt: img.alt || "",
          dataUrl: dataUrl,
        };
      } catch (err) {
        console.error("Error converting image to base64:", err);
        return {
          src: img.src,
          alt: img.alt || "",
          dataUrl: null,
        };
      }
    })
  );

  // Get links
  const links = Array.from(element.querySelectorAll("a")).map((a) => ({
    href: a.href,
    text: a.textContent || "",
  }));

  // Get videos
  const videos = Array.from(
    element.querySelectorAll(
      'video, iframe[src*="youtube"], iframe[src*="vimeo"]'
    )
  ).map((v) => ({
    src: v.src || v.getAttribute("src") || "",
    type: v.tagName.toLowerCase(),
    // Extract thumbnail for YouTube videos
    thumbnail: v.src?.includes("youtube.com")
      ? `https://img.youtube.com/vi/${getYouTubeVideoId(v.src)}/hqdefault.jpg`
      : null,
  }));

  return {
    text: text.trim().substring(0, 5000), // Limit text length
    images,
    links,
    videos,
    elementType: element.tagName.toLowerCase(),
  };
}

// Categorize content using AI (via backend API)
async function categorizeContent(content) {
  try {
    const result = await chrome.storage.sync.get(["synapse_token", "api_url"]);
    if (!result.synapse_token) {
      throw new Error("Not authenticated");
    }

    const apiUrl = result.api_url || "http://localhost:3000";

    const response = await fetch(`${apiUrl}/api/ai/categorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${result.synapse_token}`,
      },
      body: JSON.stringify({
        text: content.text,
        hasImages: content.images.length > 0,
        hasVideos: content.videos.length > 0,
        hasLinks: content.links.length > 0,
        elementType: content.elementType,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to categorize content");
    }

    const data = await response.json();
    return data.segmentType || "Study";
  } catch (error) {
    console.error("Error categorizing:", error);
    // Fallback categorization
    if (content.images.length > 0) return "Images";
    if (content.videos.length > 0) return "Videos";
    if (
      content.links.some(
        (link) => link.href.includes("amazon") || link.href.includes("product")
      )
    )
      return "Products";
    if (content.text.length > 500) return "Articles";
    return "Study";
  }
}

// Save content to backend
async function saveContent(element, content, segmentType) {
  const html = element.outerHTML.substring(0, 100000); // Limit HTML size

  await chrome.runtime.sendMessage({
    action: "saveContent",
    data: {
      content,
      html,
      segmentType,
      metadata: {
        timestamp: new Date().toISOString(),
        elementType: element.tagName.toLowerCase(),
        className: element.className || "",
        id: element.id || "",
      },
    },
  });
}

// Stop capture mode
function stopCaptureMode() {
  captureMode = false;
  document.removeEventListener("mouseover", handleMouseOver, true);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleEscape);

  if (overlay) {
    overlay.remove();
    overlay = null;
  }

  const highlight = document.getElementById("synapse-highlight");
  if (highlight) {
    highlight.remove();
  }

  const notification = document.getElementById("synapse-notification");
  if (notification) {
    setTimeout(() => {
      if (notification) notification.remove();
    }, 3000);
  }
}

// Handle ESC key
function handleEscape(e) {
  if (e.key === "Escape" && captureMode) {
    stopCaptureMode();
    showNotification("Capture cancelled", "info");
  }
}

// Show notification
// Convert image URL to base64
async function getImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

// Extract YouTube video ID from URL
function getYouTubeVideoId(url) {
  try {
    const urlObj = new URL(url);
    // Handle different YouTube URL formats
    if (urlObj.hostname.includes("youtube.com")) {
      if (urlObj.pathname === "/watch") {
        return urlObj.searchParams.get("v");
      } else if (urlObj.pathname.startsWith("/embed/")) {
        return urlObj.pathname.split("/")[2];
      }
    } else if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }
  } catch (error) {
    console.error("Error parsing YouTube URL:", error);
  }
  return null;
}

function showNotification(message, type = "info") {
  const existing = document.getElementById("synapse-notification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.id = "synapse-notification";
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${
      type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#6366f1"
    };
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;
  document.body.appendChild(notification);

  if (type !== "error") {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }
}
