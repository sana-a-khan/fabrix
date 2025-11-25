const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
require("dotenv").config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Helmet for security headers
app.use(helmet());

// Security: Restrict CORS to Chrome extension only
// For production, you'll need to add your deployed domain
const allowedOrigins = [
  "chrome-extension://", // Chrome extensions
  "moz-extension://",    // Firefox extensions
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin starts with allowed extension protocols
    const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// Security: Request size limits (prevent large payload attacks)
app.use(express.json({ limit: "50kb" }));

// Security: Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Stricter rate limit for AI analysis endpoint (more expensive)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit to 30 AI requests per 15 minutes
  message: "Too many analysis requests, please try again later.",
});

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

// Security: Input validation helper
function validateText(text) {
  if (!text || typeof text !== "string") {
    return { valid: false, error: "Text must be a non-empty string" };
  }

  // Trim and limit length (no HTML escaping - this goes to OpenAI, not HTML)
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Text cannot be empty" };
  }

  if (trimmed.length > 20000) {
    return { valid: false, error: "Text too long (max 20,000 characters)" };
  }

  return { valid: true, sanitized: trimmed };
}

function validateProductData(data) {
  const errors = [];

  if (!data.url || !validator.isURL(data.url, { require_protocol: true })) {
    errors.push("Invalid or missing URL");
  }

  if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
    errors.push("Invalid or missing title");
  }

  if (data.title && data.title.length > 500) {
    errors.push("Title too long (max 500 characters)");
  }

  if (!data.brand || typeof data.brand !== "string" || data.brand.trim().length === 0) {
    errors.push("Invalid or missing brand");
  }

  if (!data.composition_grade || !["Natural", "Synthetic", "Semi-Synthetic", "Mixed", "Unknown"].includes(data.composition_grade)) {
    errors.push("Invalid composition_grade");
  }

  if (!Array.isArray(data.fibers)) {
    errors.push("fibers must be an array");
  } else {
    // Validate each fiber in the array
    data.fibers.forEach((fiber, index) => {
      if (!fiber.name || typeof fiber.name !== "string" || fiber.name.trim().length === 0) {
        errors.push(`fibers[${index}]: fiber name must be a non-empty string`);
      }
      if (typeof fiber.percentage !== "number" || isNaN(fiber.percentage)) {
        errors.push(`fibers[${index}]: percentage must be a valid number`);
      } else if (fiber.percentage < 0) {
        errors.push(`fibers[${index}]: percentage cannot be negative`);
      } else if (fiber.percentage > 100) {
        errors.push(`fibers[${index}]: percentage cannot exceed 100`);
      }
    });
  }

  if (data.lining !== null && !Array.isArray(data.lining)) {
    errors.push("lining must be an array or null");
  } else if (Array.isArray(data.lining)) {
    // Validate each lining fiber
    data.lining.forEach((fiber, index) => {
      if (!fiber.name || typeof fiber.name !== "string" || fiber.name.trim().length === 0) {
        errors.push(`lining[${index}]: fiber name must be a non-empty string`);
      }
      if (typeof fiber.percentage !== "number" || isNaN(fiber.percentage)) {
        errors.push(`lining[${index}]: percentage must be a valid number`);
      } else if (fiber.percentage < 0) {
        errors.push(`lining[${index}]: percentage cannot be negative`);
      } else if (fiber.percentage > 100) {
        errors.push(`lining[${index}]: percentage cannot exceed 100`);
      }
    });
  }

  if (data.trim !== null && data.trim !== undefined && !Array.isArray(data.trim)) {
    errors.push("trim must be an array or null");
  } else if (Array.isArray(data.trim)) {
    // Validate each trim fiber
    data.trim.forEach((fiber, index) => {
      if (!fiber.name || typeof fiber.name !== "string" || fiber.name.trim().length === 0) {
        errors.push(`trim[${index}]: fiber name must be a non-empty string`);
      }
      if (typeof fiber.percentage !== "number" || isNaN(fiber.percentage)) {
        errors.push(`trim[${index}]: percentage must be a valid number`);
      } else if (fiber.percentage < 0) {
        errors.push(`trim[${index}]: percentage cannot be negative`);
      } else if (fiber.percentage > 100) {
        errors.push(`trim[${index}]: percentage cannot exceed 100`);
      }
    });
  }

  return errors;
}

app.post("/analyze", aiLimiter, async (req, res) => {
  try {
    const { text } = req.body;

    // Security: Validate and sanitize input
    const validation = validateText(text);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // DEBUG: Log first 1000 chars of text being analyzed
    console.log("\n=== ANALYZING TEXT (first 1000 chars) ===");
    console.log(validation.sanitized.substring(0, 1000));
    console.log("=== END TEXT PREVIEW ===\n");

    const systemPrompt = `
You are a strict fashion data extractor.
Analyze the product text and return ONLY valid JSON matching this structure:
{
  "fibers": [{"name": "material_name", "percentage": number}],
  "lining": [{"name": "material_name", "percentage": number}] (or null),
  "trim": [{"name": "material_name", "percentage": number}] (or null),
  "other": [{"label": "section_name", "fibers": [{"name": "material_name", "percentage": number}]}] (or null),
  "composition_grade": "Natural" | "Synthetic" | "Semi-Synthetic" | "Mixed" | "Unknown"
}

CRITICAL RULES:
1. ONLY extract fiber data if you find EXPLICIT percentages (e.g., "60% cotton", "40% polyester")
2. If you see fiber names WITHOUT percentages (e.g., "made with merino wool"), return "Unknown"
3. If you see vague terms like "soft knit" or "luxe fabric", return "Unknown"
4. DO NOT make up or estimate percentages
5. DO NOT infer composition from product descriptions or marketing text
6. YOU MUST include ALL fibers with percentages - do not skip any components
7. If you find multiple percentage lists, use the one that adds up to 100% (this is the official composition)
8. IGNORE marketing descriptions that only mention some fibers - look for the complete composition field

HANDLING MULTIPLE SECTIONS:
- "Content", "Shell", "Body", "Fabric", "Main" = main fibers array
- "Lining" = lining array (interior fabric layer)
- "Trim", "Ribbed Trim", "Cuffs", "Collar", "Binding", "Rib" = trim array (decorative/finishing elements)
- "Interlining", "Interfacing", "Padding", "Fill", "Insulation" = other array (less relevant structural elements)
- If you see multiple composition sections, classify them correctly:
  - Main body composition goes in "fibers"
  - Interior lining goes in "lining"
  - Decorative elements (ribbing, cuffs, collar) go in "trim"
  - Interlining/padding/insulation goes in "other" with the label (e.g., {"label": "Interlining", "fibers": [...]})

CRITICAL: DO NOT DUPLICATE OR SPLIT DATA ACROSS ARRAYS
- When you see "Content: X; Trim: Y" or "Shell: X; Lining: Y", these are SEPARATE sections
- ALL fibers listed under "Content"/"Shell" go ONLY in the "fibers" array
- ALL fibers listed under "Trim" go ONLY in the "trim" array
- ALL fibers listed under "Lining" go ONLY in the "lining" array
- DO NOT mix fibers from different sections into the same array
- DO NOT split a section's fibers across multiple arrays

Example 1: "Content: 100% cashmere; Trim: 90% cashmere, 9% nylon, 1% elastane"
  CORRECT: {
    "fibers": [{"name": "cashmere", "percentage": 100}],
    "trim": [{"name": "cashmere", "percentage": 90}, {"name": "nylon", "percentage": 9}, {"name": "elastane", "percentage": 1}]
  }
  WRONG #1: {
    "fibers": [{"name": "cashmere", "percentage": 100}, {"name": "cashmere", "percentage": 90}, {"name": "nylon", "percentage": 9}, {"name": "elastane", "percentage": 1}]
  }
  WRONG #2: {
    "fibers": [{"name": "cashmere", "percentage": 100}, {"name": "nylon", "percentage": 9}, {"name": "elastane", "percentage": 1}],
    "trim": [{"name": "cashmere", "percentage": 90}]
  }

Example 2: "Shell: 60% cotton, 40% polyester; Lining: 100% polyester"
  CORRECT: {
    "fibers": [{"name": "cotton", "percentage": 60}, {"name": "polyester", "percentage": 40}],
    "lining": [{"name": "polyester", "percentage": 100}]
  }

RECYCLED/SUSTAINABLE MATERIALS - Include in fiber name:
- If you see "Recycled", "Reclaimed", "LENZING ECOVERO", "Tencel", "Repreve", "rPET", add "(Recycled)" suffix
- Examples:
  - "Recycled Polyester" -> name: "polyester (Recycled)"
  - "LENZING ECOVERO Viscose" -> name: "viscose (Recycled)"
  - "Tencel Lyocell" -> name: "lyocell (Recycled)"
  - "Organic Cotton" -> name: "cotton (Organic)" (organic is different from recycled)
  - "Regular Cotton" -> name: "cotton"

FIBER CLASSIFICATIONS:
Natural fibers: cotton, wool, silk, linen, cashmere, alpaca, mohair, hemp, ramie, jute, merino
Petroleum-based synthetics: polyester, nylon, polyamide, acrylic
Plant-based synthetics (semi-synthetic): viscose, rayon, modal, lyocell, tencel, cupro, bamboo
Other synthetics: spandex, elastane, lycra

GRADING RULES (when percentages ARE found):
1. Grade based ONLY on the main "fibers" section (ignore lining and trim when grading)
2. Grade "Natural" if 100% natural fibers (cotton, wool, silk, linen, etc.) with no synthetics
3. Grade "Semi-Synthetic" if 50% or more plant-based synthetics (viscose, rayon, modal, lyocell, tencel, bamboo, cupro)
4. Grade "Synthetic" if 50% or more petroleum-based synthetics (polyester, nylon, acrylic)
5. Grade "Mixed" if contains multiple fiber types but no category reaches 50%
6. When grading, ignore (Recycled) or (Organic) suffixes - grade based on the base fiber type
7. Elastane/spandex in small amounts (typically 2-10%) doesn't change the grade if the main fiber is clear

IMPORTANT:
- Viscose, rayon, modal, lyocell, tencel are PLANT-BASED (semi-synthetic), not petroleum synthetics
- Polyester, nylon, acrylic are PETROLEUM-BASED synthetics
- ALWAYS include ALL fibers - never skip elastane, spandex, or small percentage components
- Percentages should add up to 100% (or close to it)

If NO explicit percentages found: {"fibers": [], "lining": null, "trim": null, "other": null, "composition_grade": "Unknown"}
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
          { role: "user", content: validation.sanitized },
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

    // DEBUG: Log what AI returned
    console.log("\n=== AI RESPONSE ===");
    console.log(cleanedAnalysis);
    console.log("=== END AI RESPONSE ===\n");

    // Security: Validate JSON before sending
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedAnalysis);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return res.status(500).json({ error: "Invalid AI response format" });
    }

    res.json(parsedData);
  } catch (error) {
    console.error("Server Error in /analyze:", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
});


app.post("/save-product", async (req, res) => {
  try {
    const productData = req.body;

    // Security: Validate all product data
    const validationErrors = validateProductData(productData);
    if (validationErrors.length > 0) {
      console.error("Validation errors:", validationErrors);
      console.error("Product data received:", JSON.stringify(productData, null, 2));
      return res.status(400).json({
        error: "Validation failed: " + validationErrors.join(", "),
        details: validationErrors
      });
    }

    // Security: Sanitize text fields
    const sanitizedData = {
      url: productData.url,
      title: validator.escape(productData.title.trim()).substring(0, 500),
      brand: validator.escape(productData.brand.trim()).substring(0, 100),
      composition_grade: productData.composition_grade,
      fibers: productData.fibers,
      lining: productData.lining,
      trim: productData.trim || null,
      raw_text: productData.raw_text ? productData.raw_text.substring(0, 20000) : "",
    };

    // Check if product already exists
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/products?url=eq.${encodeURIComponent(sanitizedData.url)}&select=check_count,fibers,lining,trim,composition_grade`,
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
        const existingProduct = existing[0];

        // Check if composition has changed
        const compositionChanged =
          JSON.stringify(existingProduct.fibers) !== JSON.stringify(sanitizedData.fibers) ||
          JSON.stringify(existingProduct.lining) !== JSON.stringify(sanitizedData.lining) ||
          JSON.stringify(existingProduct.trim) !== JSON.stringify(sanitizedData.trim) ||
          existingProduct.composition_grade !== sanitizedData.composition_grade;

        // Update product with new check count and potentially new composition data
        const updateData = {
          check_count: checkCount,
          ...(compositionChanged ? {
            fibers: sanitizedData.fibers,
            lining: sanitizedData.lining,
            trim: sanitizedData.trim,
            composition_grade: sanitizedData.composition_grade,
            title: sanitizedData.title,
            brand: sanitizedData.brand,
            raw_text: sanitizedData.raw_text,
          } : {})
        };

        await fetch(`${SUPABASE_URL}/rest/v1/products?url=eq.${encodeURIComponent(sanitizedData.url)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify(updateData),
        });

        return res.status(200).json({
          message: "Already in library!",
          alreadyExists: true,
          checkCount: checkCount,
          compositionChanged: compositionChanged
        });
      }
    }

    // Insert new product with check_count = 1
    const insertData = { ...sanitizedData, check_count: 1 };
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
      console.error("Supabase API Error (full response):", JSON.stringify(err, null, 2));
      console.error("Response status:", response.status);
      const errorMessage = err.message || err.hint || err.details || JSON.stringify(err);
      return res
        .status(response.status)
        .json({
          error: "Database Error: " + errorMessage
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
  console.log("Security features enabled: CORS restrictions, rate limiting, input validation");
});
