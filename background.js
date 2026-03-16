// background.js
const RAILWAY_HOST = "https://api.instroom.io";

// Listen for URL updates to handle navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, { message: "url_changed", url: changeInfo.url }, () => {
      chrome.runtime.lastError;
    });
  }
});

// Handle extension icon click to toggle the sidebar
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { message: "toggle_sidebar" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "profile_url") {
    chrome.storage.local.get(["usageCount", "lastReset"], (result) => {
      const MAX_USAGE = 1000;
      let usageCount = result.usageCount || 0;
      const currentMonth = new Date().toISOString().slice(0, 7);

      if (result.lastReset !== currentMonth) {
        usageCount = 0;
        chrome.storage.local.set({ usageCount: 0, lastReset: currentMonth });
      }

      if (usageCount >= MAX_USAGE) {
        const tabId = sender.tab.id;
        chrome.tabs.sendMessage(tabId, {
          message: "usage_limit_reached",
          error: "You have reached your monthly usage limit.",
          remaining: 0,
        });
        sendResponse({ error: "Usage limit reached" });
        return;
      }

      usageCount++;
      chrome.storage.local.set({ usageCount }, () => {
        sendResponse({ success: true });
        const tabId = sender.tab.id;
        const remaining = MAX_USAGE - usageCount;
        chrome.tabs.sendMessage(tabId, { message: "remaining_credits", remaining });

        const username = request.username || extractUsernameFromUrl(request.url);
        if (username) {
          if (request.url.includes("tiktok.com")) {
            fetchTikTokData(username, tabId);
          } else {
            fetchInstagramData(username, request.profilePicUrl, tabId);
          }
        } else {
          chrome.tabs.sendMessage(tabId, {
            message: "profile_data_error",
            error: "Invalid profile URL.",
          });
        }
      });
    });
    return true;
  }
});

function extractUsernameFromUrl(profileUrl) {
  const parts = profileUrl.split("/");
  if (profileUrl.includes("tiktok.com") && parts.length >= 4) {
    const segment = parts[3].trim();
    return segment.startsWith('@') ? segment.substring(1) : segment || null;
  }
  if (parts.length >= 4) {
    return parts[3].trim() || null;
  }
  return null;
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// --- INSTAGRAM ---

async function fetchInstagramData(username, directProfilePicUrl, tabId) {
  try {
    const response = await fetchWithTimeout(`${RAILWAY_HOST}/${username}/instagram`);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const result = await response.json();

    chrome.tabs.sendMessage(tabId, {
      message: "instagram_data",
      data: {
        username: result.username || username,
        email: result.email || "email not available",
        followers_count: result.followers || "N/A",
        location: result.location || "N/A",
        profilePicUrl: directProfilePicUrl || result.photo,
        engagement_rate: result.engagement_rate || "N/A",
        avg_likes: result.avg_likes || "N/A",
        avg_comments: result.avg_comments || "N/A",
        avg_video_views: result.avg_video_views || "N/A",
      },
    });
  } catch (error) {
    console.error("Error fetching Instagram data:", error);
    chrome.tabs.sendMessage(tabId, { message: "instagram_data_error", error: "Failed to fetch Instagram data." });
  }
}

// --- TIKTOK ---

async function fetchTikTokData(username, tabId) {
  try {
    const response = await fetch(`${RAILWAY_HOST}/${username}/tiktok`);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const result = await response.json();

    chrome.tabs.sendMessage(tabId, {
      message: "tiktok_data",
      data: {
        username: (result.username || username).replace(/^@/, ""),
        email: result.email || "email not available",
        followers_count: parseInt(String(result.followers || "0").replace(/,/g, ""), 10),
        location: result.country || "N/A",
        profilePicUrl: result.avatar || null,
        engagement_rate: result.engagement_rate || "N/A",
        avg_likes: result.avg_hearts || "N/A",
        avg_comments: result.avg_comments || "N/A",
        avg_video_views: result.avg_views || "N/A",
      },
    });
  } catch (error) {
    console.error("Error fetching TikTok data:", error);
    chrome.tabs.sendMessage(tabId, { message: "tiktok_data_error", error: "Failed to fetch TikTok data." });
  }
}
