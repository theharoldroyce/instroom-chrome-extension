// content.js

function waitForElement(selector, fallbackSelector) {
  return new Promise(resolve => {
    const mainElement = document.querySelector(selector);
    if (mainElement) {
      return resolve(mainElement);
    }
    if (fallbackSelector) {
        const fallbackElement = document.querySelector(fallbackSelector);
        if(fallbackElement) return resolve(fallbackElement);
    }

    const observer = new MutationObserver(mutations => {
        const mainElement = document.querySelector(selector);
        if (mainElement) {
            resolve(mainElement);
            observer.disconnect();
        } else if (fallbackSelector) {
            const fallbackElement = document.querySelector(fallbackSelector);
            if(fallbackElement) {
                resolve(fallbackElement);
                observer.disconnect();
            }
        }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Keep this listener for communication with the sidebar iframe
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_profile_url") {
      (async () => {
        const profileUrl = window.location.href;
        const profilePicUrl = await getProfilePicUrlFromPage();
        const userId = getUserIdFromPage();
        const username = getUsernameFromUrl();
        const msg = {
          message: "profile_url",
          url: profileUrl,
          profilePicUrl: profilePicUrl,
          userId: userId,
          username: username,
        };
        
        chrome.runtime.sendMessage(msg);

        // Also forward to iframe immediately so it can show the username/pic while loading
        const iframe = document.getElementById("instroom-sidebar-frame");
        if (iframe) {
            iframe.contentWindow.postMessage(msg, "*");
        }
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
        "profile_data", "profile_data_error",
        "post_stats_data", "post_stats_error",
        "reels_stats_data", "reels_stats_error",
        "tiktok_email_data", "tiktok_stats_data", "tiktok_stats_error",
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

  function getUserIdFromPage() {
    try {
      const metaTag = document.querySelector('meta[property="al:ios:url"]');
      if (metaTag) {
        const content = metaTag.getAttribute('content');
        const match = content.match(/user\?id=(\d+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    } catch (e) {
      console.error("Error extracting user ID:", e);
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

  async function getTikTokProfilePicUrl() {
    try {
      // Generic selector for TikTok avatar (often has class containing 'Avatar')
      const imgElement = await waitForElement('img[class*="Avatar"]', 'span[shape="circle"] img');
      if (imgElement) return imgElement.src;
    } catch (e) {
      console.error("Error extracting TikTok profile picture:", e);
    }
    return null;
  }

  async function getProfilePicUrlFromPage() {
    const hostname = window.location.hostname;
    if (hostname.includes("instagram.com")) {
      return await getInstagramProfilePicUrl();
    } else if (hostname.includes("tiktok.com")) {
      return await getTikTokProfilePicUrl();
    }
    return null;
  }