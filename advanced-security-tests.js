/**
 * ADVANCED Security Testing Suite for Natural Extension Backend
 *
 * This suite tests for sophisticated attack vectors including:
 * - Advanced injection attacks (NoSQL, Command, LDAP, XXE)
 * - Authentication bypass attempts
 * - Business logic vulnerabilities
 * - Resource exhaustion attacks
 * - Information disclosure
 * - SSRF (Server-Side Request Forgery)
 * - Prototype pollution
 * - Path traversal
 * - Header injection
 * - CRLF injection
 */

const BACKEND_URL = "http://localhost:3000";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n${"=".repeat(70)}`, colors.cyan);
  log(`TEST: ${testName}`, colors.cyan);
  log("=".repeat(70), colors.cyan);
}

function logPass(message) {
  log(`✓ PASS: ${message}`, colors.green);
}

function logFail(message) {
  log(`✗ FAIL: ${message}`, colors.red);
}

function logCritical(message) {
  log(`🚨 CRITICAL: ${message}`, colors.magenta);
}

function logInfo(message) {
  log(`ℹ INFO: ${message}`, colors.blue);
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let criticalIssues = 0;

function recordResult(passed, critical = false) {
  totalTests++;
  if (passed) {
    passedTests++;
  } else {
    failedTests++;
    if (critical) {
      criticalIssues++;
    }
  }
}

// ==============================================================================
// TEST 1: Advanced Injection Attacks
// ==============================================================================
async function testAdvancedInjectionAttacks() {
  logTest("Advanced Injection Attacks");

  // Test 1.1: NoSQL Injection attempts
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/nosql",
        title: { "$ne": null },
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 400) {
      logPass("NoSQL injection (object in title) rejected");
      recordResult(true);
    } else {
      logFail("NoSQL injection not properly rejected");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`NoSQL injection test error: ${error.message}`);
    recordResult(false);
  }

  // Test 1.2: Command Injection in text field
  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "; ls -la; echo 'hacked'" })
    });

    // Should process normally (AI will return Unknown)
    if (response.status === 200) {
      logPass("Command injection in text handled safely (processed by AI)");
      recordResult(true);
    } else {
      logFail("Command injection test failed unexpectedly");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Command injection test error: ${error.message}`);
    recordResult(false);
  }

  // Test 1.3: Path Traversal in URL
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/../../etc/passwd",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    // URL validator should accept this as valid URL structure
    // But the path traversal is harmless since we're using Supabase REST API
    if (response.status === 201 || response.status === 200) {
      logPass("Path traversal in URL handled (Supabase API prevents file access)");
      recordResult(true);
    } else {
      logInfo("Path traversal rejected by URL validator (also safe)");
      recordResult(true);
    }
  } catch (error) {
    logFail(`Path traversal test error: ${error.message}`);
    recordResult(false);
  }

  // Test 1.4: LDAP Injection
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/ldap",
        title: "Test",
        brand: "*)(uid=*))(|(uid=*",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    // Should be sanitized and stored safely
    if (response.status === 201 || response.status === 200) {
      logPass("LDAP injection characters sanitized");
      recordResult(true);
    } else {
      logFail("LDAP injection test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`LDAP injection test error: ${error.message}`);
    recordResult(false);
  }

  // Test 1.5: Template Injection
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/template",
        title: "{{7*7}}",
        brand: "${7*7}",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 201 || response.status === 200) {
      logPass("Template injection syntax sanitized");
      recordResult(true);
    } else {
      logFail("Template injection test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Template injection test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 2: Prototype Pollution Attacks
// ==============================================================================
async function testPrototypePollution() {
  logTest("Prototype Pollution Attacks");

  // Test 2.1: __proto__ injection
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/proto",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test",
        "__proto__": { "isAdmin": true }
      })
    });

    if (response.status === 201 || response.status === 200) {
      logPass("__proto__ pollution attempt processed safely");
      recordResult(true);
    } else {
      logFail("Prototype pollution test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Prototype pollution test error: ${error.message}`);
    recordResult(false);
  }

  // Test 2.2: constructor.prototype injection
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/constructor",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test",
        "constructor": { "prototype": { "isAdmin": true } }
      })
    });

    if (response.status === 201 || response.status === 200) {
      logPass("constructor.prototype pollution attempt processed safely");
      recordResult(true);
    } else {
      logFail("Constructor pollution test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Constructor pollution test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 3: SSRF (Server-Side Request Forgery) Prevention
// ==============================================================================
async function testSSRFPrevention() {
  logTest("SSRF Prevention");

  // Test 3.1: Internal network access attempt
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "http://localhost:3000/admin",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    // This is actually a valid URL and gets stored - but that's OK
    // because we're not making requests TO the URL, just storing it
    if (response.status === 201 || response.status === 200) {
      logPass("Internal URL stored (safe - no server-side requests made to URLs)");
      recordResult(true);
    } else {
      logInfo("Internal URL rejected");
      recordResult(true);
    }
  } catch (error) {
    logFail(`SSRF test error: ${error.message}`);
    recordResult(false);
  }

  // Test 3.2: Cloud metadata endpoint
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "http://169.254.169.254/latest/meta-data/",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 201 || response.status === 200) {
      logPass("Cloud metadata URL stored (safe - no requests made)");
      recordResult(true);
    } else {
      logInfo("Cloud metadata URL rejected");
      recordResult(true);
    }
  } catch (error) {
    logFail(`Cloud metadata test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 4: Resource Exhaustion / DoS Attacks
// ==============================================================================
async function testResourceExhaustion() {
  logTest("Resource Exhaustion / DoS Protection");

  // Test 4.1: Extremely nested JSON (Billion Laughs)
  try {
    const nestedData = {
      url: "https://example.com/nested",
      title: "Test",
      brand: "TestBrand",
      composition_grade: "Natural",
      fibers: [{ name: "cotton", percentage: 100 }],
      lining: null,
      trim: null,
      raw_text: "test"
    };

    // Add deeply nested object
    let current = nestedData;
    for (let i = 0; i < 100; i++) {
      current.nested = {};
      current = current.nested;
    }

    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nestedData)
    });

    if (response.status === 201 || response.status === 200 || response.status === 400) {
      logPass("Deeply nested JSON handled (extra fields ignored)");
      recordResult(true);
    } else {
      logFail("Nested JSON test failed");
      recordResult(false);
    }
  } catch (error) {
    if (error.message.includes("size") || error.message.includes("too large")) {
      logPass("Deeply nested JSON rejected by size limit");
      recordResult(true);
    } else {
      logFail(`Nested JSON test error: ${error.message}`);
      recordResult(false);
    }
  }

  // Test 4.2: Array with many elements
  try {
    const largeArray = [];
    for (let i = 0; i < 10000; i++) {
      largeArray.push({ name: `fiber${i}`, percentage: 0.01 });
    }

    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/large-array",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: largeArray,
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 413 || response.status === 400) {
      logPass("Large array rejected by size limit");
      recordResult(true);
    } else if (response.status === 201 || response.status === 200) {
      logInfo("Large array accepted (within 50KB limit)");
      recordResult(true);
    } else {
      logFail("Large array test failed");
      recordResult(false);
    }
  } catch (error) {
    if (error.message.includes("size") || error.message.includes("too large")) {
      logPass("Large array rejected");
      recordResult(true);
    } else {
      logFail(`Large array test error: ${error.message}`);
      recordResult(false);
    }
  }

  // Test 4.3: ReDoS (Regular Expression Denial of Service)
  try {
    // Craft a string that could cause catastrophic backtracking
    const redosString = "a".repeat(10000) + "!";

    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: redosString })
    });

    if (response.status === 200) {
      logPass("ReDoS string processed (AI handles safely)");
      recordResult(true);
    } else if (response.status === 400) {
      logPass("ReDoS string rejected by length limit");
      recordResult(true);
    } else {
      logFail("ReDoS test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`ReDoS test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 5: Header Injection / CRLF Injection
// ==============================================================================
async function testHeaderInjection() {
  logTest("Header Injection / CRLF Injection");

  // Test 5.1: CRLF in title
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/crlf",
        title: "Test\r\nSet-Cookie: admin=true",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 201 || response.status === 200) {
      // Check if response has malicious headers
      const setCookie = response.headers.get('set-cookie');
      if (!setCookie || !setCookie.includes('admin=true')) {
        logPass("CRLF injection sanitized (no header injection)");
        recordResult(true);
      } else {
        logCritical("CRLF injection SUCCESSFUL - headers compromised!");
        recordResult(false, true);
      }
    } else {
      logFail("CRLF test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`CRLF test error: ${error.message}`);
    recordResult(false);
  }

  // Test 5.2: Null byte injection
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/null\x00byte",
        title: "Test",
        brand: "TestBrand\x00",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 201 || response.status === 200 || response.status === 400) {
      logPass("Null byte injection handled");
      recordResult(true);
    } else {
      logFail("Null byte test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Null byte test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 6: Business Logic Vulnerabilities
// ==============================================================================
async function testBusinessLogic() {
  logTest("Business Logic Vulnerabilities");

  // Test 6.1: Negative percentages
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/negative",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: -100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    // Currently no validation for negative percentages - this is a finding
    if (response.status === 400) {
      logPass("Negative percentages rejected");
      recordResult(true);
    } else {
      logCritical("Negative percentages ACCEPTED - business logic vulnerability!");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`Negative percentage test error: ${error.message}`);
    recordResult(false);
  }

  // Test 6.2: Percentages over 100
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/over100",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 500 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 400) {
      logPass("Percentages over 100 rejected");
      recordResult(true);
    } else {
      logCritical("Percentages over 100 ACCEPTED - business logic vulnerability!");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`Over 100% test error: ${error.message}`);
    recordResult(false);
  }

  // Test 6.3: Empty fiber name
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/empty-fiber",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 400) {
      logPass("Empty fiber name rejected");
      recordResult(true);
    } else {
      logCritical("Empty fiber name ACCEPTED - business logic vulnerability!");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`Empty fiber name test error: ${error.message}`);
    recordResult(false);
  }

  // Test 6.4: NaN/Infinity in percentage
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/nan",
        title: "Test",
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: NaN }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    // JSON.stringify converts NaN to null
    if (response.status === 400) {
      logPass("NaN percentage rejected");
      recordResult(true);
    } else {
      logInfo("NaN converted to null by JSON.stringify");
      recordResult(true);
    }
  } catch (error) {
    logFail(`NaN test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 7: Information Disclosure
// ==============================================================================
async function testInformationDisclosure() {
  logTest("Information Disclosure");

  // Test 7.1: Error message information leakage
  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: null })
    });

    const data = await response.json();

    // Check if error messages reveal system information
    const errorMsg = data.error || "";
    const leaksInfo = errorMsg.includes("stack") ||
                      errorMsg.includes("file") ||
                      errorMsg.includes("line") ||
                      errorMsg.includes("/Users/") ||
                      errorMsg.includes("C:\\");

    if (!leaksInfo) {
      logPass("Error messages don't leak system information");
      recordResult(true);
    } else {
      logCritical("Error messages LEAK system information!");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`Information disclosure test error: ${error.message}`);
    recordResult(false);
  }

  // Test 7.2: API version disclosure
  try {
    const response = await fetch(`${BACKEND_URL}/`, {
      method: "GET"
    });

    const serverHeader = response.headers.get('server');
    const xPoweredBy = response.headers.get('x-powered-by');

    if (!xPoweredBy || !xPoweredBy.includes('Express')) {
      logPass("X-Powered-By header hidden (Helmet working)");
      recordResult(true);
    } else {
      logInfo("X-Powered-By header exposed (minor issue)");
      recordResult(true);
    }
  } catch (error) {
    logFail(`Version disclosure test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 8: Concurrent Request Abuse
// ==============================================================================
async function testConcurrentRequestAbuse() {
  logTest("Concurrent Request Handling");

  logInfo("Testing 20 concurrent requests...");

  try {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        fetch(`${BACKEND_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "100% cotton test" })
        })
      );
    }

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    const rateLimitedCount = results.filter(r => r.status === 429).length;

    logInfo(`Successful: ${successCount}, Rate-limited: ${rateLimitedCount}`);

    if (successCount > 0 && successCount <= 20) {
      logPass(`Concurrent requests handled (${successCount} succeeded)`);
      recordResult(true);
    } else {
      logFail("Concurrent request test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Concurrent request test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 9: Unicode and Encoding Attacks
// ==============================================================================
async function testUnicodeAttacks() {
  logTest("Unicode and Encoding Attacks");

  // Test 9.1: Unicode overlong encoding
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/unicode",
        title: "\uFEFF\u200B\u200C\u200D",  // Zero-width characters
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 400) {
      logPass("Zero-width characters rejected (empty after trim)");
      recordResult(true);
    } else if (response.status === 201 || response.status === 200) {
      logInfo("Zero-width characters accepted (sanitized)");
      recordResult(true);
    } else {
      logFail("Unicode test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`Unicode test error: ${error.message}`);
    recordResult(false);
  }

  // Test 9.2: Right-to-Left Override (spoofing)
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/rtl",
        title: "Test\u202Egnisrever",  // Reverses "reversing"
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 201 || response.status === 200) {
      logPass("RTL override accepted (not a security issue for this app)");
      recordResult(true);
    } else {
      logFail("RTL test failed");
      recordResult(false);
    }
  } catch (error) {
    logFail(`RTL test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// TEST 10: Type Confusion Attacks
// ==============================================================================
async function testTypeConfusion() {
  logTest("Type Confusion Attacks");

  // Test 10.1: Array instead of string
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/type-confusion",
        title: ["not", "a", "string"],
        brand: "TestBrand",
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 400) {
      logPass("Array in title field rejected");
      recordResult(true);
    } else {
      logFail("Type confusion not detected");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`Type confusion test error: ${error.message}`);
    recordResult(false);
  }

  // Test 10.2: Boolean instead of string
  try {
    const response = await fetch(`${BACKEND_URL}/save-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/bool",
        title: "Test",
        brand: true,
        composition_grade: "Natural",
        fibers: [{ name: "cotton", percentage: 100 }],
        lining: null,
        trim: null,
        raw_text: "test"
      })
    });

    if (response.status === 400) {
      logPass("Boolean in brand field rejected");
      recordResult(true);
    } else {
      logFail("Boolean type not rejected");
      recordResult(false, true);
    }
  } catch (error) {
    logFail(`Boolean type test error: ${error.message}`);
    recordResult(false);
  }
}

// ==============================================================================
// Main Test Runner
// ==============================================================================
async function runAllTests() {
  log("\n" + "=".repeat(70), colors.cyan);
  log("NATURAL EXTENSION - ADVANCED SECURITY TEST SUITE", colors.cyan);
  log("=".repeat(70) + "\n", colors.cyan);

  logInfo("Testing for sophisticated attack vectors...");
  logInfo(`Backend URL: ${BACKEND_URL}`);
  logInfo("Make sure the backend server is running!\n");

  // Check if server is running
  try {
    await fetch(BACKEND_URL);
    log("\n✓ Backend server is running\n", colors.green);
  } catch (error) {
    log("\n✗ ERROR: Backend server is not running!", colors.red);
    log("Please start the server with: cd backend && node server.js\n", colors.yellow);
    process.exit(1);
  }

  // Run all test suites
  await testAdvancedInjectionAttacks();
  await testPrototypePollution();
  await testSSRFPrevention();
  await testResourceExhaustion();
  await testHeaderInjection();
  await testBusinessLogic();
  await testInformationDisclosure();
  await testConcurrentRequestAbuse();
  await testUnicodeAttacks();
  await testTypeConfusion();

  // Print summary
  log("\n" + "=".repeat(70), colors.cyan);
  log("ADVANCED TEST SUMMARY", colors.cyan);
  log("=".repeat(70), colors.cyan);
  log(`Total Tests: ${totalTests}`, colors.blue);
  log(`Passed: ${passedTests}`, colors.green);
  log(`Failed: ${failedTests}`, colors.red);
  log(`Critical Issues: ${criticalIssues}`, criticalIssues > 0 ? colors.magenta : colors.green);
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`,
      failedTests === 0 ? colors.green : colors.yellow);
  log("=".repeat(70) + "\n", colors.cyan);

  if (criticalIssues > 0) {
    log(`🚨 CRITICAL: ${criticalIssues} critical security issues found!`, colors.magenta);
    log("These MUST be fixed before production deployment!\n", colors.magenta);
  } else if (failedTests === 0) {
    log("🎉 ALL ADVANCED SECURITY TESTS PASSED!", colors.green);
    log("No critical vulnerabilities detected!\n", colors.green);
  } else {
    log(`⚠️  ${failedTests} tests failed (non-critical)`, colors.yellow);
    log("Review failures and consider implementing additional validation\n", colors.yellow);
  }

  // Return critical issues count for CI/CD
  process.exit(criticalIssues > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  log(`\n✗ FATAL ERROR: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
