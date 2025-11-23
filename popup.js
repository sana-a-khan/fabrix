const OPENAI_BACKEND_URL = "http://localhost:3000/analyze";
const SUPABASE_BACKEND_URL = "http://localhost:3000/save-product";

document.getElementById("scanBtn").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Scanning... <br><small>(Analyzing Fabric...)</small>";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getPageDetails,
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

    resultDiv.innerHTML += "<br><small>Saving to Library...</small>";
    await saveToSupabase(data, url, title, brand, rawText);
    resultDiv.innerHTML += " ✅ Saved!";
  } catch (error) {
    console.error(error);
    resultDiv.innerHTML += `<br><span class="error">Error: ${error.message}</span>`;
  }
});

function getPageDetails() {
  const bodyText = document.body?.innerText || document.documentElement?.innerText || "";
  return {
    rawText: bodyText.substring(0, 6000),
    url: window.location.href,
    title: document.title,
  };
}

async function analyzeWithAI(text) {
  const response = await fetch(OPENAI_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error("OpenAI API Error: " + err.error.message);
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
      raw_text: rawText,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error("Database Error: " + err.message);
  }
}

function renderResults(data, container) {
  let color = "#27ae60";
  if (data.composition_grade === "Synthetic") {
    color = "#c0392b";
  } else if (
    data.composition_grade === "Mixed" ||
    data.composition_grade === "Semi-Synthetic"
  ) {
    color = "#d35400";
  }

  let html = `<h3 style="color:${color}; margin-bottom:5px;">${data.composition_grade}</h3>`;

  html += `<strong>Shell:</strong><ul>`;
  data.fibers.forEach((f) => {
    html += `<li>${f.percentage}% ${f.name}</li>`;
  });
  html += `</ul>`;

  if (data.lining && data.lining.length > 0) {
    html += `<hr style="border:0; border-top:1px solid #eee;"><strong>Lining:</strong><ul>`;
    data.lining.forEach((l) => {
      html += `<li>${l.percentage}% ${l.name}</li>`;
    });
    html += `</ul>`;
  }

  container.innerHTML = html;
}