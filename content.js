// content.js

function waitForElement(selector, fallbackSelector, timeoutMs = 3000) {
  return new Promise(resolve => {
    const mainElement = document.querySelector(selector);
    if (mainElement) return resolve(mainElement);
    if (fallbackSelector) {
      const fallbackElement = document.querySelector(fallbackSelector);
      if (fallbackElement) return resolve(fallbackElement);
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(timer); observer.disconnect(); resolve(el); return; }
      if (fallbackSelector) {
        const fb = document.querySelector(fallbackSelector);
        if (fb) { clearTimeout(timer); observer.disconnect(); resolve(fb); }
      }
    });

    const timer = setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Keep this listener for communication with the sidebar iframe
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.message === "get_profile_url") {
      (async () => {
        const isTikTok = window.location.hostname.includes("tiktok.com");
        const profilePicUrl = isTikTok ? null : await getInstagramProfilePicUrl();
        const msg = {
          message: "profile_url",
          url: window.location.href,
          profilePicUrl: profilePicUrl,
          username: getUsernameFromUrl(),
        };
        
        chrome.runtime.sendMessage(msg);

        // Also forward to iframe immediately so it can show the username/pic while loading
        const iframe = document.getElementById("instroom-sidebar-frame");
        if (iframe) {
            iframe.contentWindow.postMessage(msg, "*");
        }
        sendResponse({ success: true });
      })();
      return true; // Indicates that the response is sent asynchronously
    }
    if (request.message === "url_changed") {
      if (lastUrl !== request.url) {
        lastUrl = request.url;
        handlePageChange();
      }
    }

    // Forward data messages from background to the iframe
    const forwardMessages = [
        "instagram_data", "instagram_data_error",
        "tiktok_data", "tiktok_data_error",
        "usage_limit_reached", "remaining_credits"
    ];

    if (forwardMessages.includes(request.message)) {
        const iframe = document.getElementById("instroom-sidebar-frame");
        if (iframe) {
            iframe.contentWindow.postMessage(request, "*");
        }
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "resize_sidebar") {
      const iframe = document.getElementById("instroom-sidebar-frame");
      if (iframe) {
        iframe.style.height = event.data.height + "px";
      }
    }
  });

  function closeSidebar() {
    const iframeId = "instroom-sidebar-frame";
    const existingIframe = document.getElementById(iframeId);
    if (existingIframe) {
      existingIframe.remove();
    }
  }

  function showSidebar() {
    const iframeId = "instroom-sidebar-frame";
    let iframe = document.getElementById(iframeId);

    if (iframe) {
        // If it exists, refresh it via message
        iframe.contentWindow.postMessage({ type: "refresh_sidebar" }, "*");
    } else {
        // If it doesn't exist, create it
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.src = chrome.runtime.getURL("instroom.html");
        iframe.style.cssText = `
        position: fixed;
        top: 15px;
        right: 15px;
        width: 340px;
        max-width: calc(100vw - 30px);
        height: 600px;
        border: none;
        z-index: 2147483647;
        border-radius: 16px;
        background: transparent;
      `;
        document.body.appendChild(iframe);
    }
  }

  // This is the part that will automatically show/hide the sidebar
  function handlePageChange() {
    if (isProfilePage()) {
      showSidebar();
    } else {
      closeSidebar();
    }
  }

  // Run on initial load
  handlePageChange();

  // And run on URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      handlePageChange();
    }
  }).observe(document, { subtree: true, childList: true });


  function getInstagramUsernameFromUrl() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length === 1) {
        const reservedWords = ['home', 'explore', 'reels', 'stories', 'p', 'tv', 'direct', 'accounts', 'developer', 'about', 'legal', 'create', 'saved', 'api', 'search'];
        if (!reservedWords.includes(segments[0].toLowerCase())) {
            return segments[0];
        }
    }
    return null;
  }

  function getTikTokUsernameFromUrl() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length > 0 && segments[0].startsWith('@')) {
      return segments[0].substring(1); // Remove the '@'
    }
    return null;
  }

  function getUsernameFromUrl() {
    const hostname = window.location.hostname;
    if (hostname.includes("instagram.com")) {
      return getInstagramUsernameFromUrl();
    } else if (hostname.includes("tiktok.com")) {
      return getTikTokUsernameFromUrl();
    }
    return null;
  }


  function isInstagramProfilePage() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length !== 1) return false;
    
    const reservedWords = ['home', 'explore', 'reels', 'stories', 'p', 'tv', 'direct', 'accounts', 'developer', 'about', 'legal', 'create', 'saved', 'api', 'search'];
    if (reservedWords.includes(segments[0].toLowerCase())) return false;
    
    return true;
  }

  function isTikTokProfilePage() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.length > 0);
    // TikTok profiles are typically /@username (exactly 1 segment starting with @)
    return segments.length === 1 && segments[0].startsWith('@');
  }

  function isProfilePage() {
    const hostname = window.location.hostname;
    if (hostname.includes("instagram.com")) {
      return isInstagramProfilePage();
    } else if (hostname.includes("tiktok.com")) {
      return isTikTokProfilePage();
    }
    return false;
  }

  async function getInstagramProfilePicUrl() {
    try {
      const imgElement = await waitForElement('img[data-testid="user-avatar"]', 'main header img');
      if (imgElement) {
        // Sometimes the src is a 1x1 pixel or placeholder, wait a moment for the real src
        await new Promise(resolve => setTimeout(resolve, 100));
        return imgElement.src;
      }
    } catch (e) {
      console.error("Error extracting Instagram profile picture URL:", e);
    }
    return null;
  }

