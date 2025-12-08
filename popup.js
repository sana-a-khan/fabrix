// Configuration - uses CONFIG from config.js (or defaults to localhost)
const BACKEND_URL = (typeof CONFIG !== 'undefined' && CONFIG.BACKEND_URL)
  ? CONFIG.BACKEND_URL
  : "http://localhost:3000";
const OPENAI_BACKEND_URL = `${BACKEND_URL}/analyze`;
const SUPABASE_BACKEND_URL = `${BACKEND_URL}/save-product`;

// ============================================
// AUTHENTICATION STATE MANAGEMENT
// ============================================

let currentUser = null;

// Check authentication status on load
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuthStatus();
});

async function checkAuthStatus() {
  const token = await getStoredToken();

  if (!token) {
    showAuthScreen();
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showScanScreen();
      updateScanInfo();
    } else {
      // Token invalid, clear and show auth
      await clearToken();
      showAuthScreen();
    }
  } catch (error) {
    console.error("Auth check failed:", error);
    showAuthScreen();
  }
}

async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["authToken"], (result) => {
      resolve(result.authToken || null);
    });
  });
}

async function storeToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ authToken: token }, resolve);
  });
}

async function clearToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["authToken"], resolve);
  });
}

function showAuthScreen() {
  document.getElementById("authScreen").style.display = "block";
  document.getElementById("scanScreen").style.display = "none";
}

function showScanScreen() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("scanScreen").style.display = "block";
}

function updateScanInfo() {
  if (!currentUser) return;

  const tierBadge = currentUser.subscription_tier === 'premium'
    ? '<span style="background:#27ae60; color:white; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:5px;">PRO</span>'
    : '<span style="background:#95a5a6; color:white; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:5px;">FREE</span>';

  document.getElementById("userInfo").innerHTML = `
    ${escapeHtml(currentUser.email)}${tierBadge}<br>
    <small style="color:#7f8c8d;">${currentUser.scans_remaining} scans remaining this month</small>
  `;
}

// ============================================
// AUTHENTICATION HANDLERS
// ============================================

document.getElementById("showSignup").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("signinForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
});

document.getElementById("showSignin").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("signinForm").style.display = "block";
});

document.getElementById("signinBtn").addEventListener("click", async () => {
  const email = document.getElementById("signinEmail").value;
  const password = document.getElementById("signinPassword").value;
  const errorDiv = document.getElementById("signinError");

  errorDiv.textContent = "";

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Sign in failed");
    }

    await storeToken(data.token);
    currentUser = data.user;
    showScanScreen();
    updateScanInfo();
  } catch (error) {
    errorDiv.textContent = error.message;
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const errorDiv = document.getElementById("signupError");

  errorDiv.textContent = "";

  if (password.length < 8) {
    errorDiv.textContent = "Password must be at least 8 characters";
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Signup failed");
    }

    await storeToken(data.token);
    currentUser = data.user;
    showScanScreen();
    updateScanInfo();
  } catch (error) {
    errorDiv.textContent = error.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await clearToken();
  currentUser = null;
  showAuthScreen();
  document.getElementById("result").innerHTML = "";
});

// ============================================
// SCAN FUNCTIONALITY
// ============================================

document.getElementById("scanBtn").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Scanning... <br><small>(Analyzing Fabric...)</small>";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    // First, execute the click actions
    const clickResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: clickCompositionElements,
    });

    // Wait for content to load after clicks
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Then read the page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getPageDetails,
    });

    // Close any modals/drawers that might have been opened and restore scrolling
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: cleanupAfterScan,
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error("Could not read page. Make sure you're on a product page.");
    }

    const { rawText, url, title } = results[0].result;

    if (!rawText || rawText.trim().length === 0) {
      throw new Error("No text found on page. Please navigate to a product page.");
    }

    const brand = new URL(url).hostname.replace("www.", "").split(".")[0];

    const data = await analyzeWithAI(rawText);

    renderResults(data, resultDiv);

    // Update scan count after successful analysis
    if (data.scans_remaining !== undefined) {
      currentUser.scans_remaining = data.scans_remaining;
      updateScanInfo();
    }

    const saveResult = await saveToSupabase(data, url, title, brand, rawText);

    if (saveResult.alreadyExists) {
      if (saveResult.compositionChanged) {
        resultDiv.innerHTML += `<br><span style="color: #e67e22;">🔄 Updated! Composition changed. Checked ${saveResult.checkCount} time(s)</span>`;
      } else {
        resultDiv.innerHTML += `<br><span style="color: #f39c12;">📚 Already in library! Checked ${saveResult.checkCount} time(s)</span>`;
      }
    } else {
      resultDiv.innerHTML += "<br>✅ Saved to library!";
    }
  } catch (error) {
    console.error("Full error object:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    resultDiv.innerHTML += `<br><span class="error">Error: ${error.message || error.toString() || 'Unknown error occurred'}</span>`;
  }
});

function clickCompositionElements() {
  // Store original overflow styles to restore if needed
  const originalBodyOverflow = document.body.style.overflow;
  const originalHtmlOverflow = document.documentElement.style.overflow;

  // Track what we've clicked to avoid clicking the same element multiple times
  const clicked = new Set();

  // Priority 1: Look for HIGH PRIORITY composition buttons (fabric, materials, composition, care)
  const highPriorityKeywords = ["fabric", "material", "composition", "care"];
  const allButtons = document.querySelectorAll('button, [role="button"], summary, [data-toggle], [aria-expanded="false"]');

  allButtons.forEach(btn => {
    const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase().trim();

    // Check if button text contains high priority keywords and is short (not full descriptions)
    if (btnText.length < 100 && highPriorityKeywords.some(keyword => btnText.includes(keyword))) {
      try {
        const isLink = btn.tagName === 'A' && btn.href && !btn.href.includes('#');
        if (!isLink) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (btn.tagName === 'SUMMARY') {
              const details = btn.closest('details');
              if (details) details.open = true;
            } else {
              btn.click();
            }
            clicked.add(btn);
          }
        }
      } catch (e) {}
    }
  });

  // Priority 2: If no high priority buttons found, try "details" or "content" buttons
  if (clicked.size === 0) {
    const lowPriorityKeywords = ["detail", "content"];

    allButtons.forEach(btn => {
      if (clicked.has(btn)) return;

      const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase().trim();

      // Only click if it's a short button text (avoid clicking description text)
      if (btnText.length < 50 && lowPriorityKeywords.some(keyword => btnText.includes(keyword))) {
        try {
          const isLink = btn.tagName === 'A' && btn.href && !btn.href.includes('#');
          if (!isLink) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              if (btn.tagName === 'SUMMARY') {
                const details = btn.closest('details');
                if (details) details.open = true;
              } else {
                btn.click();
              }
              clicked.add(btn);
            }
          }
        } catch (e) {}
      }
    });
  }

  // Priority 3: Open any <details> elements that aren't already open
  const detailsElements = document.querySelectorAll('details:not([open])');
  detailsElements.forEach(details => {
    const text = (details.textContent || '').toLowerCase();
    if (text.includes('fabric') || text.includes('material') || text.includes('composition') || text.includes('care')) {
      details.open = true;
    }
  });

  // Restore scrolling if it was disabled by any clicks
  if (document.body.style.overflow === 'hidden' && originalBodyOverflow !== 'hidden') {
    document.body.style.overflow = originalBodyOverflow;
  }
  if (document.documentElement.style.overflow === 'hidden' && originalHtmlOverflow !== 'hidden') {
    document.documentElement.style.overflow = originalHtmlOverflow;
  }
}

function cleanupAfterScan() {
  // Close any modals/drawers that might have been opened
  const modals = document.querySelectorAll('[class*="modal"][style*="display"], [class*="drawer"][style*="display"], [role="dialog"]');
  modals.forEach(modal => {
    // Try to find and click close buttons
    const closeBtn = modal.querySelector('[aria-label*="close" i], [class*="close"], button[aria-label*="close" i]');
    if (closeBtn) {
      try {
        closeBtn.click();
      } catch (e) {}
    }
    // Or just hide the modal
    if (modal.style.display !== 'none') {
      modal.style.display = 'none';
    }
  });

  // Force restore scrolling
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';

  // Remove any backdrop/overlay elements
  const backdrops = document.querySelectorAll('[class*="backdrop"], [class*="overlay"]');
  backdrops.forEach(backdrop => {
    if (backdrop.style.display !== 'none') {
      backdrop.style.display = 'none';
    }
  });
}

function getPageDetails() {
  // Strategy: Prioritize complete composition fields (with percentages adding to ~100%)
  // over marketing text (which often only mentions some fibers)

  const fabricKeywords = ["composition", "material", "fabric", "care", "content", "shell", "lining", "polyester", "cotton", "wool", "nylon", "polyamide", "viscose", "elastane"];

  // Store all potential composition sections with scores
  const sections = [];

  // Helper function to normalize composition text for deduplication
  function normalizeComposition(text) {
    // Extract just the percentages and fiber names, ignore surrounding text
    const percentages = text.match(/(\d+)%\s*([a-z\s]+)/gi) || [];
    return percentages.map(p => p.toLowerCase().trim()).sort().join('|');
  }

  // Helper function to detect if text contains multiple "100%" statements (likely multiple products)
  function hasMultipleProducts(text) {
    const hundredPercents = (text.match(/100%/g) || []).length;
    // If we see 100% more than 2 times, it's probably multiple products
    return hundredPercents > 2;
  }

  // Helper function to score a text block based on how likely it's the official composition
  function scoreCompositionText(text) {
    let score = 0;
    const lower = text.toLowerCase();

    // HIGHEST priority: Contains "content:" with percentages (this is THE official field)
    if (lower.includes('content:') && text.includes('%')) score += 500;

    // High priority: Contains "composition:", "fabric:", etc. (official labels)
    if (lower.match(/\b(composition|fabric|material)s?:/)) score += 100;

    // Count percentage symbols (more = more complete)
    const percentCount = (text.match(/%/g) || []).length;
    score += percentCount * 20;

    // Check if percentages might add up to ~100%
    const percentages = text.match(/(\d+)%/g);
    if (percentages) {
      const total = percentages.reduce((sum, p) => sum + parseInt(p), 0);
      // If total is close to 100, this is likely the complete composition
      if (total >= 95 && total <= 105) score += 300;
      // If total is way less than 100, it's probably marketing text
      if (total < 90) score -= 100;
    }

    // Penalize text containing marketing keywords
    if (lower.includes('made with') || lower.includes('sourced from') || lower.includes('premier')) {
      score -= 150;
    }

    // HEAVILY penalize text that looks like multiple products
    if (hasMultipleProducts(text)) {
      score -= 1000;
    }

    // Shorter, focused text is better (avoid long product descriptions)
    if (text.length < 300) score += 30;
    if (text.length > 1000) score -= 20;

    return score;
  }

  // Collect all potential composition sections
  const allElements = document.querySelectorAll("*");
  const seen = new Set();
  const seenCompositions = new Set();

  allElements.forEach(element => {
    const text = element.textContent || "";

    // Skip if we've already seen this text (avoid duplicates)
    if (seen.has(text) || text.length === 0) return;

    // Only consider elements that:
    // 1. Contain fabric keywords AND percentages, OR
    // 2. Contain composition-specific labels
    const hasKeywords = fabricKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const hasPercentages = text.includes("%");
    const hasLabel = text.toLowerCase().match(/\b(content|composition|fabric|material)s?:/);

    if ((hasKeywords && hasPercentages) || hasLabel) {
      // Only include reasonably-sized text blocks
      if (text.length < 2000) {
        // Check for duplicate compositions using normalized form
        const normalized = normalizeComposition(text);
        if (normalized && !seenCompositions.has(normalized)) {
          const score = scoreCompositionText(text);
          // Only add sections with positive scores
          if (score > 0) {
            sections.push({ text, score });
            seen.add(text);
            seenCompositions.add(normalized);
          }
        }
      }
    }
  });

  // Sort sections by score (highest first = most likely to be official composition)
  sections.sort((a, b) => b.score - a.score);

  // Take only top 3 highest-scoring sections to avoid overwhelming the AI
  const topSections = sections.slice(0, 3);

  // Build the text to send to AI, with highest-scoring sections first
  let prioritizedText = "";
  topSections.forEach(section => {
    prioritizedText += section.text + "\n\n---\n\n";
  });

  return {
    rawText: prioritizedText.substring(0, 20000),
    url: window.location.href,
    title: document.title,
  };
}

async function analyzeWithAI(text) {
  const token = await getStoredToken();

  const response = await fetch(OPENAI_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const err = await response.json();

    // Handle specific error cases
    if (response.status === 403 && err.scans_remaining !== undefined) {
      // Out of scans
      throw new Error(err.message || err.error);
    }

    if (response.status === 429) {
      // Rate limited or abuse detected
      throw new Error(err.message || "Too many requests. Please try again later.");
    }

    throw new Error(err.error || "Analysis failed");
  }

  const data = await response.json();
  return data;
}

async function saveToSupabase(data, url, title, brand, rawText) {
  const response = await fetch(SUPABASE_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      title,
      brand,
      composition_grade: data.composition_grade,
      fibers: data.fibers,
      lining: data.lining,
      trim: data.trim,
      raw_text: rawText,
    }),
  });

  if (!response.ok) {
    let errorMessage = "Unknown error";
    try {
      const err = await response.json();
      errorMessage = err.error || err.message || err.hint || err.details || JSON.stringify(err);
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error("Database Error: " + errorMessage);
  }

  const result = await response.json();
  return result;
}

// Security: HTML sanitization helper to prevent XSS
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    unsafe = String(unsafe);
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderResults(data, container) {
  let color = "#27ae60";
  if (data.composition_grade === "Synthetic") {
    color = "#c0392b";
  } else if (data.composition_grade === "Semi-Synthetic") {
    color = "#3498db";
  } else if (data.composition_grade === "Mixed") {
    color = "#d35400";
  } else if (data.composition_grade === "Unknown") {
    color = "#95a5a6";
  }

  // Security: Sanitize the composition grade before rendering
  const safeGrade = escapeHtml(data.composition_grade);
  let html = `<h3 style="color:${color}; margin-bottom:5px;">${safeGrade}</h3>`;

  if (data.composition_grade === "Unknown") {
    html += `<p style="color:#7f8c8d; font-size:13px;">No fabric composition information found on this page.</p>`;
    html += `<p style="color:#95a5a6; font-size:12px; margin-top:10px;">💡 Tip: Try clicking on product details, care instructions, or composition links before scanning.</p>`;
  } else {
    if (data.fibers && data.fibers.length > 0) {
      html += `<strong>Shell:</strong><ul>`;
      data.fibers.forEach((f) => {
        // Security: Sanitize fiber data before rendering
        let safeName = escapeHtml(f.name);
        const safePercentage = escapeHtml(f.percentage);

        // Check if name contains (Recycled) or (Organic) and add visual badge
        if (safeName.includes('(Recycled)')) {
          safeName = safeName.replace('(Recycled)', '<span style="color:#27ae60; font-size:11px;">♻️ Recycled</span>');
        } else if (safeName.includes('(Organic)')) {
          safeName = safeName.replace('(Organic)', '<span style="color:#27ae60; font-size:11px;">🌱 Organic</span>');
        }

        html += `<li>${safePercentage}% ${safeName}</li>`;
      });
      html += `</ul>`;
    }

    if (data.lining && data.lining.length > 0) {
      html += `<hr style="border:0; border-top:1px solid #eee;"><strong>Lining:</strong><ul>`;
      data.lining.forEach((l) => {
        // Security: Sanitize lining data before rendering
        let safeName = escapeHtml(l.name);
        const safePercentage = escapeHtml(l.percentage);

        // Check if name contains (Recycled) or (Organic) and add visual badge
        if (safeName.includes('(Recycled)')) {
          safeName = safeName.replace('(Recycled)', '<span style="color:#27ae60; font-size:11px;">♻️ Recycled</span>');
        } else if (safeName.includes('(Organic)')) {
          safeName = safeName.replace('(Organic)', '<span style="color:#27ae60; font-size:11px;">🌱 Organic</span>');
        }

        html += `<li>${safePercentage}% ${safeName}</li>`;
      });
      html += `</ul>`;
    }

    if (data.trim && data.trim.length > 0) {
      html += `<hr style="border:0; border-top:1px solid #eee;"><strong>Trim:</strong><ul>`;
      data.trim.forEach((t) => {
        // Security: Sanitize trim data before rendering
        let safeName = escapeHtml(t.name);
        const safePercentage = escapeHtml(t.percentage);

        // Check if name contains (Recycled) or (Organic) and add visual badge
        if (safeName.includes('(Recycled)')) {
          safeName = safeName.replace('(Recycled)', '<span style="color:#27ae60; font-size:11px;">♻️ Recycled</span>');
        } else if (safeName.includes('(Organic)')) {
          safeName = safeName.replace('(Organic)', '<span style="color:#27ae60; font-size:11px;">🌱 Organic</span>');
        }

        html += `<li>${safePercentage}% ${safeName}</li>`;
      });
      html += `</ul>`;
    }

    // Display "other" sections (interlining, padding, etc.) but these are NOT saved to database
    if (data.other && data.other.length > 0) {
      data.other.forEach((section) => {
        const safeLabel = escapeHtml(section.label);
        html += `<hr style="border:0; border-top:1px solid #eee;"><strong>${safeLabel}:</strong><ul>`;
        section.fibers.forEach((f) => {
          let safeName = escapeHtml(f.name);
          const safePercentage = escapeHtml(f.percentage);

          // Check if name contains (Recycled) or (Organic) and add visual badge
          if (safeName.includes('(Recycled)')) {
            safeName = safeName.replace('(Recycled)', '<span style="color:#27ae60; font-size:11px;">♻️ Recycled</span>');
          } else if (safeName.includes('(Organic)')) {
            safeName = safeName.replace('(Organic)', '<span style="color:#27ae60; font-size:11px;">🌱 Organic</span>');
          }

          html += `<li>${safePercentage}% ${safeName}</li>`;
        });
        html += `</ul>`;
      });
    }
  }

  container.innerHTML = html;
}