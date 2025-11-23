const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config({ path: "../.env" });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!OPENAI_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Critical Error: Missing API keys in .env file.");
  console.error(
    "Please ensure your .env file in the root directory is correctly configured."
  );
  process.exit(1);
}

app.post("/analyze", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided for analysis." });
    }

    const systemPrompt = `
You are a strict fashion data extractor.
Analyze the product text and return ONLY valid JSON matching this structure:
{
  "fibers": [{"name": "material_name", "percentage": number}],
  "lining": [{"name": "material_name", "percentage": number}] (or null),
  "composition_grade": "Natural" | "Synthetic" | "Mixed"
}
RULES:
1. Normalize names: "Spandex"->"elastane", "Lyocell"->"lyocell".
2. Recycled Polyester IS "polyester".
3. Grade logic: "Natural" only if 100% natural fibers. Any synthetic in shell = "Mixed" or "Synthetic".
    `.trim();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("OpenAI API Error:", err);
      return res
        .status(response.status)
        .json({ error: "OpenAI API Error: " + err.error.message });
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    const cleanedAnalysis = analysis.replace(/```json/g, "").replace(/```/g, "");

    res.json(JSON.parse(cleanedAnalysis));
  } catch (error) {
    console.error("Server Error in /analyze:", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
});


app.post("/save-product", async (req, res) => {
  try {
    const productData = req.body;
    if (!productData || !productData.url) {
      return res
        .status(400)
        .json({ error: "Product data is missing or invalid." });
    }

    // Check if product already exists
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/products?url=eq.${encodeURIComponent(productData.url)}&select=check_count`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      if (existing && existing.length > 0) {
        const checkCount = (existing[0].check_count || 0) + 1;

        // Update check count
        await fetch(`${SUPABASE_URL}/rest/v1/products?url=eq.${encodeURIComponent(productData.url)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ check_count: checkCount }),
        });

        return res.status(200).json({
          message: "Already in library!",
          alreadyExists: true,
          checkCount: checkCount
        });
      }
    }

    // Insert new product with check_count = 1
    const insertData = { ...productData, check_count: 1 };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(insertData),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Supabase API Error:", err);
      return res
        .status(response.status)
        .json({
          error: "Database Error: " + (err.message || err.hint || "Unknown error. Check if RLS policies are configured.")
        });
    }

    res.status(201).json({
      message: "Saved successfully!",
      alreadyExists: false,
      checkCount: 1
    });
  } catch (error) {
    console.error("Server Error in /save-product:", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
});

app.listen(PORT, () => {
  console.log(`ntrl backend server listening on http://localhost:${PORT}`);
});