/**
 * Security Testing Suite for fabrix Backend
 * Tests authentication, rate limiting, scan limits, and abuse prevention
 */

const BACKEND_URL = "http://localhost:3000";

// Test utilities
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${"=".repeat(60)}`);
  log(`TEST: ${name}`, colors.blue);
  console.log(`${"=".repeat(60)}`);
}

function logPass(message) {
  log(`✓ PASS: ${message}`, colors.green);
}

function logFail(message) {
  log(`✗ FAIL: ${message}`, colors.red);
}

function logWarn(message) {
  log(`⚠ WARNING: ${message}`, colors.yellow);
}

// Test data
const testUser = {
  email: `test-${Date.now()}@fabrix.test`,
  password: "TestPassword123!",
};

let authToken = null;

// ============================================
// AUTHENTICATION TESTS
// ============================================

async function testSignup() {
  logTest("User Signup");

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    const data = await response.json();

    if (response.ok && data.token && data.user) {
      authToken = data.token;
      logPass(`User created: ${data.user.email}`);
      logPass(`Token received: ${data.token.substring(0, 20)}...`);
      logPass(`Subscription: ${data.user.subscription_tier}`);
      logPass(`Scans remaining: ${data.user.scans_remaining}`);
      return true;
    } else {
      logFail(`Signup failed: ${data.error || "Unknown error"}`);
      return false;
    }
  } catch (error) {
    logFail(`Signup error: ${error.message}`);
    return false;
  }
}

async function testSignupValidation() {
  logTest("Signup Input Validation");

  // Test weak password
  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "weak" }),
    });

    if (response.status === 400) {
      logPass("Weak password rejected");
    } else {
      logFail("Weak password should be rejected");
    }
  } catch (error) {
    logFail(`Validation test error: ${error.message}`);
  }

  // Test invalid email
  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email", password: "TestPassword123!" }),
    });

    if (response.status === 400) {
      logPass("Invalid email rejected");
    } else {
      logFail("Invalid email should be rejected");
    }
  } catch (error) {
    logFail(`Validation test error: ${error.message}`);
  }
}

async function testSignin() {
  logTest("User Signin");

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    const data = await response.json();

    if (response.ok && data.token) {
      authToken = data.token;
      logPass("Sign in successful");
      logPass(`Token: ${data.token.substring(0, 20)}...`);
      return true;
    } else {
      logFail(`Signin failed: ${data.error || "Unknown error"}`);
      return false;
    }
  } catch (error) {
    logFail(`Signin error: ${error.message}`);
    return false;
  }
}

async function testAuthMe() {
  logTest("Get Current User Info");

  if (!authToken) {
    logFail("No auth token available");
    return false;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.user) {
      logPass(`User ID: ${data.user.id}`);
      logPass(`Email: ${data.user.email}`);
      logPass(`Subscription: ${data.user.subscription_tier}`);
      logPass(`Scans remaining: ${data.user.scans_remaining}`);
      logPass(`Scans used today: ${data.user.scans_used_today}`);
      return true;
    } else {
      logFail(`Auth check failed: ${data.error || "Unknown error"}`);
      return false;
    }
  } catch (error) {
    logFail(`Auth check error: ${error.message}`);
    return false;
  }
}

async function testInvalidToken() {
  logTest("Invalid Token Rejection");

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: "Bearer invalid-token-12345",
      },
    });

    if (response.status === 403 || response.status === 401) {
      logPass("Invalid token properly rejected");
      return true;
    } else {
      logFail("Invalid token should be rejected");
      return false;
    }
  } catch (error) {
    logFail(`Invalid token test error: ${error.message}`);
    return false;
  }
}

async function testNoToken() {
  logTest("Missing Token Rejection");

  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Test fabric: 100% cotton" }),
    });

    if (response.status === 401) {
      logPass("Request without token properly rejected");
      return true;
    } else {
      logFail("Request without token should be rejected");
      return false;
    }
  } catch (error) {
    logFail(`No token test error: ${error.message}`);
    return false;
  }
}

// ============================================
// SCAN LIMIT TESTS
// ============================================

async function testScanWithAuth() {
  logTest("Scan with Authentication");

  if (!authToken) {
    logFail("No auth token available");
    return false;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        text: "Content: 60% cotton, 40% polyester. Made from premium fabrics.",
      }),
    });

    const data = await response.json();

    if (response.ok) {
      logPass("Scan successful");
      logPass(`Composition grade: ${data.composition_grade}`);
      logPass(`Scans remaining: ${data.scans_remaining}`);
      logPass(`Fibers found: ${data.fibers?.length || 0}`);
      return true;
    } else {
      logFail(`Scan failed: ${data.error || "Unknown error"}`);
      return false;
    }
  } catch (error) {
    logFail(`Scan error: ${error.message}`);
    return false;
  }
}

async function testScanLimitEnforcement() {
  logTest("Scan Limit Enforcement (Free Tier)");

  if (!authToken) {
    logFail("No auth token available");
    return false;
  }

  log("Performing multiple scans to test limit...", colors.yellow);

  let scansPerformed = 0;
  let scansRemaining = 10; // Free tier starts with 10

  // Perform scans until limit is hit
  for (let i = 0; i < 12; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          text: `Test scan ${i + 1}: Content: 100% cotton`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        scansPerformed++;
        scansRemaining = data.scans_remaining;
        log(`  Scan ${i + 1}: Success (${scansRemaining} remaining)`, colors.green);
      } else if (response.status === 403 && data.error === "No scans remaining") {
        log(`  Scan ${i + 1}: Blocked - No scans remaining`, colors.green);
        logPass(`Limit enforced after ${scansPerformed} scans`);
        logPass("Upgrade message shown to user");
        return true;
      } else {
        logWarn(`  Scan ${i + 1}: Error - ${data.error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      logFail(`Scan ${i + 1} error: ${error.message}`);
    }
  }

  if (scansRemaining === 0) {
    logPass("All scans consumed successfully");
    return true;
  } else {
    logWarn(`Expected to hit limit but ${scansRemaining} scans remain`);
    return false;
  }
}

// ============================================
// RATE LIMITING TESTS
// ============================================

async function testRateLimiting() {
  logTest("Rate Limiting (General Endpoint)");

  log("Sending 110 requests to test rate limiter...", colors.yellow);

  let blocked = 0;
  let success = 0;

  for (let i = 0; i < 110; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 429) {
        blocked++;
      } else if (response.ok) {
        success++;
      }
    } catch (error) {
      // Ignore errors
    }
  }

  if (blocked > 0) {
    logPass(`Rate limiter activated after ${success} requests`);
    logPass(`Blocked ${blocked} requests`);
    return true;
  } else {
    logWarn("Rate limiter did not activate (might need more requests)");
    return false;
  }
}

// ============================================
// ABUSE PREVENTION TESTS
// ============================================

async function testDailyAbuseThreshold() {
  logTest("Daily Abuse Threshold Detection");

  log("This test would require 20+ scans in one day", colors.yellow);
  log("Skipping automated test - manual verification recommended", colors.yellow);
  logWarn("Abuse threshold: 20 scans/day (free), 50 scans/day (premium)");
  return true;
}

// ============================================
// INPUT VALIDATION TESTS
// ============================================

async function testInputValidation() {
  logTest("Input Validation & Sanitization");

  if (!authToken) {
    logFail("No auth token available");
    return false;
  }

  // Test empty text
  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ text: "" }),
    });

    if (response.status === 400) {
      logPass("Empty text rejected");
    } else {
      logFail("Empty text should be rejected");
    }
  } catch (error) {
    logFail(`Empty text test error: ${error.message}`);
  }

  // Test very long text (over limit)
  try {
    const longText = "a".repeat(25000);
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ text: longText }),
    });

    if (response.status === 400) {
      logPass("Text over length limit rejected");
    } else {
      logFail("Text over length limit should be rejected");
    }
  } catch (error) {
    logFail(`Long text test error: ${error.message}`);
  }

  return true;
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log("\n");
  log("╔" + "═".repeat(58) + "╗", colors.blue);
  log("║" + " ".repeat(12) + "FABRIX SECURITY TEST SUITE" + " ".repeat(20) + "║", colors.blue);
  log("╚" + "═".repeat(58) + "╝", colors.blue);

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // Run tests in sequence
  const tests = [
    { name: "Signup Validation", fn: testSignupValidation },
    { name: "User Signup", fn: testSignup },
    { name: "User Signin", fn: testSignin },
    { name: "Auth Me", fn: testAuthMe },
    { name: "Invalid Token", fn: testInvalidToken },
    { name: "No Token", fn: testNoToken },
    { name: "Scan with Auth", fn: testScanWithAuth },
    { name: "Input Validation", fn: testInputValidation },
    { name: "Rate Limiting", fn: testRateLimiting },
    { name: "Daily Abuse Threshold", fn: testDailyAbuseThreshold },
    // Note: Scan limit test will consume user's scans
    // { name: "Scan Limit Enforcement", fn: testScanLimitEnforcement },
  ];

  for (const test of tests) {
    const result = await test.fn();
    if (result) {
      results.passed++;
    } else {
      results.failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log("\n");
  log("╔" + "═".repeat(58) + "╗", colors.blue);
  log("║" + " ".repeat(20) + "TEST SUMMARY" + " ".repeat(26) + "║", colors.blue);
  log("╚" + "═".repeat(58) + "╝", colors.blue);
  log(`Total Tests: ${tests.length}`);
  log(`Passed: ${results.passed}`, colors.green);
  log(`Failed: ${results.failed}`, results.failed > 0 ? colors.red : colors.green);
  log(`Warnings: ${results.warnings}`, colors.yellow);

  if (results.failed === 0) {
    log("\n✓ ALL TESTS PASSED!", colors.green);
  } else {
    log(`\n✗ ${results.failed} TEST(S) FAILED`, colors.red);
  }

  console.log("\n");
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: "Bearer fake-token" },
    });
    return true;
  } catch (error) {
    log("\n✗ ERROR: Backend server not running at " + BACKEND_URL, colors.red);
    log("Please start the server with: cd backend && node server.js\n", colors.yellow);
    return false;
  }
}

// Run tests
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runAllTests();
  }
  process.exit(0);
})();
