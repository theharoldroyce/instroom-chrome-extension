// instroom.js
document.addEventListener("DOMContentLoaded", () => {
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const profileDataDiv = document.getElementById("profile-data");
  const usernameSpan = document.getElementById("username");
  const emailSpan = document.getElementById("email");
  const followersSpan = document.getElementById("followers");
  const locationSpan = document.getElementById("country");
  const engagementRateSpan = document.getElementById("engagement-rate");
  const averageLikesSpan = document.getElementById("average-likes");
  const averageCommentsSpan = document.getElementById("average-comments");
  const averageReelPlaysSpan = document.getElementById("average-reel-plays");
  const remainingCreditsSpan = document.getElementById("remaining-credits");
  const profileSection = document.querySelector(".profile-section");
  const profilePicImg = document.getElementById("profile-pic");

  let followersCountForEngagement = null; // Store followers count for engagement calculation
  let cachedPostStats = null; // Store post stats if they arrive before profile data

  function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) {
      return "N/A";
    }
    if (num < 1000) {
      return num.toString();
    }
    if (num < 1000000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    if (num < 1000000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }

  function displayCommonProfileData(data) {
    usernameSpan.textContent = data.username || "N/A";
    emailSpan.textContent = data.email || "N/A";
    locationSpan.textContent = data.location || "N/A";

    if (data.profilePicUrl) {
      profilePicImg.src = data.profilePicUrl;
    } else {
      profilePicImg.src = "images/instroomLogo.png"; // Fallback to default logo
    }
  }

  function displayInstagramData(data) {
    displayCommonProfileData(data);
    followersSpan.textContent = formatNumber(data.followers_count);
    // engagementRateSpan is calculated later from post stats
  
    followersCountForEngagement = parseInt(
      (data.followers_count || "0").toString().replace(/,/g, ""),
      10
    );
  
    // If post stats came first, display them now
    if (cachedPostStats) {
      displayPostStats(cachedPostStats);
    }
  }

  function displayTikTokData(data) {
    displayCommonProfileData(data);
    followersSpan.textContent = formatNumber(data.followers_count);
    // Only update if data is provided, otherwise leave spinner from initial load
    if (data.engagement_rate) {
      engagementRateSpan.textContent = data.engagement_rate;
    }
    if (data.average_likes) {
      averageLikesSpan.textContent = formatNumber(data.average_likes);
    }
    if (data.average_comments) {
      averageCommentsSpan.textContent = formatNumber(data.average_comments);
    }
    if (data.average_views) {
      averageReelPlaysSpan.textContent = formatNumber(data.average_views);
    }
  }

function displayPostStats(data) {
  cachedPostStats = data;
  const POST_COUNT = 12;
  // Calculate averages
  let avgLikes = "N/A";
  let avgComments = "N/A";
  if (
    typeof data.totalLikes === "number" &&
    typeof data.totalComments === "number"
  ) {
    avgLikes = formatNumber(Math.round(data.totalLikes / POST_COUNT));
    avgComments = formatNumber(Math.round(data.totalComments / POST_COUNT));
  }

  averageLikesSpan.textContent = avgLikes;
  averageCommentsSpan.textContent = avgComments;

  // Engagement rate calculation (as previously discussed)
  if (
    typeof data.totalLikes === "number" &&
    typeof data.totalComments === "number" &&
    followersCountForEngagement &&
    followersCountForEngagement > 0
  ) {
    const avgEngagement = (data.totalLikes + data.totalComments) / POST_COUNT;
    const engagementRate = (avgEngagement / followersCountForEngagement) * 100;
    engagementRateSpan.textContent = engagementRate.toFixed(2) + "%";
  }
}

  function displayReelsStats(data) {
    if (data.averagePlays) {
      // Use toLocaleString() to format the number with commas
      averageReelPlaysSpan.textContent = formatNumber(parseInt(data.averagePlays, 10));
    } else {
      averageReelPlaysSpan.textContent = "N/A";
    }
  }

  function displayError(message) {
    loadingDiv.style.display = "none";
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }

  window.addEventListener("message", (event) => {
    const request = event.data;
    if (!request) return;

    if (request.type === "refresh_sidebar") {
      loadingDiv.style.display = "block";
      profileDataDiv.style.display = "none";
      errorDiv.style.display = "none";

      const spinnerHtml = '<div class="spinner"></div>';
      engagementRateSpan.innerHTML = spinnerHtml;
      averageLikesSpan.innerHTML = spinnerHtml;
      averageCommentsSpan.innerHTML = spinnerHtml;
      averageReelPlaysSpan.innerHTML = spinnerHtml;

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { message: "get_profile_url" });
      });
    } else if (request.message === "profile_data") {
      console.log("Full data object received in popup:", request.data);

      loadingDiv.style.display = "none";
      profileDataDiv.style.display = "block";

      profilePicImg.onerror = () => {
        console.error("Failed to load image:", profilePicImg.src);
      };

      if (request.data.profileUrl && request.data.profileUrl.includes("tiktok.com")) {
        displayTikTokData(request.data);
      } else {
        displayInstagramData(request.data);
      }
    } else if (request.message === "profile_url") {
        const profilePicImg = document.getElementById("profile-pic");
        const usernameSpan = document.getElementById("username");
        
        if (request.profilePicUrl) {
            profilePicImg.src = request.profilePicUrl;
        }
        if (request.username) {
            usernameSpan.textContent = request.username;
        }

        // Since we get some data, hide loading and show the profile section
        if (request.profilePicUrl || request.username) {
            loadingDiv.style.display = "none";
            profileDataDiv.style.display = "block";
        }
    } else if (request.message === "profile_data_error") {
      displayError(request.error);
    } else if (request.message === "post_stats_data") {
      displayPostStats(request.data);
    } else if (request.message === "post_stats_error") {
      console.error("Error fetching post stats:", request.error);
      // Also handle reels error display
      displayReelsStats({ averagePlays: "Error" });
      displayPostStats({ totalLikes: "Error", totalComments: "Error" });
    } else if (request.message === "reels_stats_data") {
      displayReelsStats(request.data);
    } else if (request.message === "tiktok_email_data") {
      if (request.data && request.data.email) {
        emailSpan.textContent = request.data.email;
      }
    } else if (request.message === "tiktok_stats_data") {
      const data = request.data;
      engagementRateSpan.textContent = data.engagement_rate || "N/A";
      averageLikesSpan.textContent = data.average_likes ? formatNumber(data.average_likes) : "N/A";
      averageCommentsSpan.textContent = data.average_comments ? formatNumber(data.average_comments) : "N/A";
      averageReelPlaysSpan.textContent = data.average_views ? formatNumber(data.average_views) : "N/A";
    } else if (request.message === "tiktok_stats_error") {
      console.error("Error fetching tiktok stats:", request.error);
      engagementRateSpan.textContent = "Error";
      averageLikesSpan.textContent = "Error";
      averageCommentsSpan.textContent = "Error";
      averageReelPlaysSpan.textContent = "Error";
    } else if (request.message === "usage_limit_reached") {
      displayError(request.error);
      profileSection.innerHTML = `
        <div class="no-credits-message">
          <p>You've reached your monthly credit limit. To continue using all features, please upgrade your plan:</p>
          <a href="https://instroom-landing-page.vercel.app/" target="_blank">Subscribe</a>
        </div>
      `;
      // Optionally, hide the profile data section
      profileDataDiv.style.display = "none";

    } else if (request.message === "remaining_credits") {
      remainingCreditsSpan.textContent = request.remaining;
    }
  });

  // On popup open, get credits and then trigger profile data fetch
  chrome.storage.local.get(["usageCount", "lastReset"], (result) => {
    const MAX_USAGE = 10;
    let usageCount = result.usageCount || 0;
    const remaining = MAX_USAGE - usageCount;
    remainingCreditsSpan.textContent = remaining;

    // Initialize spinners
    const spinnerHtml = '<div class="spinner"></div>';
    engagementRateSpan.innerHTML = spinnerHtml;
    averageLikesSpan.innerHTML = spinnerHtml;
    averageCommentsSpan.innerHTML = spinnerHtml;
    averageReelPlaysSpan.innerHTML = spinnerHtml;

    // Now, send a message to the content script to get the URL.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { message: "get_profile_url" });
    });
  });

  const resizeObserver = new ResizeObserver(() => {
    const height = document.body.scrollHeight;
    window.parent.postMessage({ type: "resize_sidebar", height: height }, "*");
  });
  resizeObserver.observe(document.body);
});
