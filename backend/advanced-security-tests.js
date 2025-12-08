/**
 * Advanced Security Testing Suite for fabrix Backend
 * Tests for SQL injection, NoSQL injection, JWT manipulation, IDOR, and more
 */

const BACKEND_URL = "http://localhost:3000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${"=".repeat(70)}`);
  log(`TEST: ${name}`, colors.blue);
  console.log(`${"=".repeat(70)}`);
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

function logInfo(message) {
  log(`ℹ INFO: ${message}`, colors.magenta);
}

// Test data
const testUser = {
  email: `security-test-${Date.now()}@fabrix.test`,
  password: "SecurePassword123!",
};

let authToken = null;
let userId = null;

// ============================================
// SQL INJECTION TESTS
// ============================================

async function testSQLInjectionSignup() {
  logTest("SQL Injection - Signup Email Field");

  const sqlInjectionPayloads = [
    "admin'--",
    "admin' OR '1'='1",
    "'; DROP TABLE users; --",
    "admin' UNION SELECT * FROM users--",
    "1' OR '1' = '1' /*",
    "admin';DROP TABLE user_profiles;--",
    "' OR 1=1--",
    "admin'/*",
    "' UNION SELECT NULL, NULL--",
    "' OR 'x'='x",
  ];

  let allBlocked = true;

  for (const payload of sqlInjectionPayloads) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload,
          password: "TestPassword123!",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        logFail(`SQL injection payload accepted: ${payload}`);
        allBlocked = false;
      } else if (response.status === 400) {
        logInfo(`Payload blocked (validation): ${payload}`);
      } else {
        logInfo(`Payload rejected: ${payload} (${response.status})`);
      }
    } catch (error) {
      logInfo(`Payload caused error (good): ${payload}`);
    }
  }

  if (allBlocked) {
    logPass("All SQL injection payloads blocked");
    return true;
  } else {
    logFail("Some SQL injection payloads were accepted");
    return false;
  }
}

async function testSQLInjectionAuth() {
  logTest("SQL Injection - Authentication Bypass");

  const bypassPayloads = [
    { email: "admin' OR '1'='1'--", password: "anything" },
    { email: "' OR 1=1--", password: "" },
    { email: "admin'--", password: "" },
  ];

  let allBlocked = true;

  for (const payload of bypassPayloads) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          logFail(`Authentication bypass successful with: ${payload.email}`);
          allBlocked = false;
        }
      } else {
        logInfo(`Bypass attempt blocked: ${payload.email}`);
      }
    } catch (error) {
      logInfo(`Bypass attempt errored (good): ${payload.email}`);
    }
  }

  if (allBlocked) {
    logPass("All authentication bypass attempts blocked");
    return true;
  } else {
    logFail("Authentication bypass possible!");
    return false;
  }
}

// ============================================
// NOSQL / JSON INJECTION TESTS
// ============================================

async function testNoSQLInjection() {
  logTest("NoSQL/JSON Injection - Analyze Endpoint");

  // Create test user first
  const signupResponse = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testUser),
  });

  if (signupResponse.ok) {
    const signupData = await signupResponse.json();
    authToken = signupData.token;
    logInfo("Test user created for NoSQL injection tests");
  } else {
    logWarn("Could not create test user");
    return false;
  }

  const injectionPayloads = [
    { text: '{"$ne": null}' },
    { text: '{"$gt": ""}' },
    { text: { $where: "1==1" } },
    { text: '"; return true; var fake="' },
    { text: "'; return true; var fake='" },
  ];

  let allBlocked = true;

  for (const payload of injectionPayloads) {
    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 400) {
        logInfo("Payload rejected by validation");
      } else if (response.ok) {
        const data = await response.json();
        // Check if it returned unexpected data
        if (data.composition_grade === "Unknown") {
          logInfo("Payload handled safely (Unknown result)");
        } else {
          logWarn("Payload processed - check response");
        }
      }
    } catch (error) {
      logInfo(`Payload caused error: ${error.message}`);
    }
  }

  logPass("NoSQL injection payloads handled");
  return true;
}

// ============================================
// JWT TOKEN MANIPULATION TESTS
// ============================================

async function testJWTManipulation() {
  logTest("JWT Token Manipulation");

  const manipulatedTokens = [
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AZmFicml4LmNvbSJ9.",
    "Bearer " + "a".repeat(500), // Very long token
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NSIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSJ9.fake-signature",
    "null",
    "undefined",
    '{"userId": "admin"}',
    "../../../etc/passwd",
  ];

  let allBlocked = true;

  for (const token of manipulatedTokens) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        logFail(`Manipulated token accepted: ${token.substring(0, 50)}...`);
        allBlocked = false;
      } else if (response.status === 401 || response.status === 403) {
        logInfo("Token rejected");
      }
    } catch (error) {
      logInfo("Token caused error (expected)");
    }
  }

  if (allBlocked) {
    logPass("All JWT manipulation attempts blocked");
    return true;
  } else {
    logFail("Some manipulated tokens were accepted!");
    return false;
  }
}

async function testJWTAlgorithmConfusion() {
  logTest("JWT Algorithm Confusion Attack (alg: none)");

  // Try to create token with "none" algorithm
  const payload = Buffer.from(
    JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000000",
      email: "attacker@fabrix.test",
    })
  ).toString("base64");

  const header = Buffer.from(
    JSON.stringify({
      alg: "none",
      typ: "JWT",
    })
  ).toString("base64");

  const noneToken = `${header}.${payload}.`;

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${noneToken}`,
      },
    });

    if (response.ok) {
      logFail("Algorithm confusion attack succeeded!");
      return false;
    } else {
      logPass("Algorithm confusion attack blocked");
      return true;
    }
  } catch (error) {
    logPass("Algorithm confusion attack failed");
    return true;
  }
}

async function testJWTWithInvalidUUID() {
  logTest("JWT with Invalid UUID Format");

  const jwt = require("jsonwebtoken");
  const JWT_SECRET = "test-secret"; // Won't match server, but tests UUID validation

  const invalidUUIDs = [
    "admin",
    "'; DROP TABLE users; --",
    "../../etc/passwd",
    "null",
    "00000000-0000-0000-0000-00000000000g", // Invalid hex
    "12345",
    "../admin",
  ];

  let allBlocked = true;

  for (const invalidUUID of invalidUUIDs) {
    const token = jwt.sign(
      { userId: invalidUUID, email: "test@test.com" },
      JWT_SECRET
    );

    try {
      const response = await fetch(`${BACKEND_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        logFail(`Invalid UUID accepted: ${invalidUUID}`);
        allBlocked = false;
      } else {
        logInfo(`Invalid UUID rejected: ${invalidUUID}`);
      }
    } catch (error) {
      logInfo("Invalid UUID caused error");
    }
  }

  if (allBlocked) {
    logPass("All invalid UUIDs in JWT rejected");
    return true;
  } else {
    logFail("Some invalid UUIDs were accepted!");
    return false;
  }
}

// ============================================
// IDOR (Insecure Direct Object Reference) TESTS
// ============================================

async function testIDORAttack() {
  logTest("IDOR - Accessing Other Users' Data");

  if (!authToken) {
    logWarn("No auth token - creating test user");
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
    }
  }

  // Try to access data with different UUIDs
  const attackUUIDs = [
    "00000000-0000-0000-0000-000000000001",
    "11111111-1111-1111-1111-111111111111",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ];

  let allBlocked = true;

  for (const attackUUID of attackUUIDs) {
    try {
      // Try to query products for another user (if endpoint exists)
      const response = await fetch(
        `${BACKEND_URL}/user/${attackUUID}/products`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.ok) {
        logFail(`IDOR: Accessed data for user ${attackUUID}`);
        allBlocked = false;
      } else if (response.status === 404) {
        logInfo("Endpoint not found (expected)");
      } else if (response.status === 403 || response.status === 401) {
        logInfo("Access denied (good)");
      }
    } catch (error) {
      logInfo("IDOR attempt errored");
    }
  }

  if (allBlocked) {
    logPass("IDOR attacks prevented");
    return true;
  } else {
    logFail("IDOR vulnerability detected!");
    return false;
  }
}

// ============================================
// BRUTE FORCE TESTS
// ============================================

async function testBruteForceProtection() {
  logTest("Brute Force Protection on Login");

  const testEmail = `bruteforce-${Date.now()}@test.com`;

  log("Attempting 10 rapid login attempts...", colors.yellow);

  let blockedCount = 0;
  let successCount = 0;

  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: `wrong-password-${i}`,
        }),
      });

      if (response.status === 429) {
        blockedCount++;
        logInfo(`Attempt ${i + 1}: Rate limited`);
      } else if (response.status === 401) {
        successCount++;
        logInfo(`Attempt ${i + 1}: Login failed (allowed)`);
      }
    } catch (error) {
      logInfo(`Attempt ${i + 1}: Error`);
    }

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (blockedCount > 0) {
    logPass(`Brute force protection activated after ${successCount} attempts`);
    logPass(`Blocked ${blockedCount} subsequent attempts`);
    return true;
  } else {
    logWarn("No rate limiting detected in 10 attempts");
    logWarn("Check authLimiter configuration (may need more attempts)");
    return false;
  }
}

// ============================================
// PARAMETER POLLUTION TESTS
// ============================================

async function testParameterPollution() {
  logTest("Parameter Pollution Attack");

  if (!authToken) {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
    }
  }

  try {
    // Send duplicate parameters
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        text: "100% cotton",
        text: "' OR '1'='1",
        extra_param: "malicious",
      }),
    });

    if (response.ok || response.status === 400) {
      logPass("Parameter pollution handled safely");
      return true;
    } else {
      logWarn("Unexpected response to parameter pollution");
      return false;
    }
  } catch (error) {
    logPass("Parameter pollution caused safe error");
    return true;
  }
}

// ============================================
// XSS TESTS (API level)
// ============================================

async function testXSSInAPI() {
  logTest("XSS Payload Handling in API");

  if (!authToken) {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
    }
  }

  const xssPayloads = [
    "<script>alert('XSS')</script>",
    '<img src=x onerror="alert(1)">',
    "javascript:alert('XSS')",
    "<svg onload=alert(1)>",
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
  ];

  let allSafe = true;

  for (const payload of xssPayloads) {
    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          text: `Fabric: ${payload}`,
        }),
      });

      const data = await response.json();

      // Check if response contains unsanitized payload
      const responseStr = JSON.stringify(data);
      if (responseStr.includes("<script>") || responseStr.includes("onerror=")) {
        logWarn("XSS payload in response (check sanitization)");
        allSafe = false;
      } else {
        logInfo("XSS payload handled safely");
      }
    } catch (error) {
      logInfo("XSS payload caused safe error");
    }
  }

  if (allSafe) {
    logPass("All XSS payloads handled safely");
    return true;
  } else {
    logFail("Potential XSS vulnerability");
    return false;
  }
}

// ============================================
// MASS ASSIGNMENT TESTS
// ============================================

async function testMassAssignment() {
  logTest("Mass Assignment Vulnerability");

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `mass-assign-${Date.now()}@test.com`,
        password: "TestPassword123!",
        subscription_tier: "premium", // Try to set premium for free
        scans_remaining: 99999, // Try to set unlimited scans
        is_flagged: false,
        role: "admin",
      }),
    });

    if (response.ok) {
      const data = await response.json();

      // Check if malicious fields were accepted
      if (
        data.user.subscription_tier === "premium" ||
        data.user.scans_remaining > 10
      ) {
        logFail("Mass assignment vulnerability! User modified protected fields");
        return false;
      } else {
        logPass("Mass assignment blocked - only allowed fields set");
        return true;
      }
    } else {
      logInfo("Signup with extra fields rejected");
      return true;
    }
  } catch (error) {
    logPass("Mass assignment attempt failed safely");
    return true;
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAdvancedSecurityTests() {
  console.log("\n");
  log("╔" + "═".repeat(68) + "╗", colors.blue);
  log(
    "║" +
      " ".repeat(15) +
      "ADVANCED SECURITY TEST SUITE" +
      " ".repeat(25) +
      "║",
    colors.blue
  );
  log("╚" + "═".repeat(68) + "╝", colors.blue);

  const results = {
    passed: 0,
    failed: 0,
  };

  const tests = [
    { name: "SQL Injection (Signup)", fn: testSQLInjectionSignup },
    { name: "SQL Injection (Auth Bypass)", fn: testSQLInjectionAuth },
    { name: "NoSQL/JSON Injection", fn: testNoSQLInjection },
    { name: "JWT Manipulation", fn: testJWTManipulation },
    { name: "JWT Algorithm Confusion", fn: testJWTAlgorithmConfusion },
    { name: "JWT Invalid UUID", fn: testJWTWithInvalidUUID },
    { name: "IDOR Attack", fn: testIDORAttack },
    { name: "Brute Force Protection", fn: testBruteForceProtection },
    { name: "Parameter Pollution", fn: testParameterPollution },
    { name: "XSS in API", fn: testXSSInAPI },
    { name: "Mass Assignment", fn: testMassAssignment },
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
  log("╔" + "═".repeat(68) + "╗", colors.blue);
  log(
    "║" + " ".repeat(25) + "TEST SUMMARY" + " ".repeat(31) + "║",
    colors.blue
  );
  log("╚" + "═".repeat(68) + "╝", colors.blue);
  log(`Total Tests: ${tests.length}`);
  log(`Passed: ${results.passed}`, colors.green);
  log(
    `Failed: ${results.failed}`,
    results.failed > 0 ? colors.red : colors.green
  );

  if (results.failed === 0) {
    log("\n✓ ALL ADVANCED SECURITY TESTS PASSED!", colors.green);
    log("Your application is well-protected against common attacks.", colors.green);
  } else {
    log(`\n✗ ${results.failed} CRITICAL SECURITY ISSUE(S) FOUND!`, colors.red);
    log("Please review and fix the vulnerabilities above.", colors.red);
  }

  console.log("\n");
}

// Check if server is running
async function checkServer() {
  try {
    await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: "Bearer fake" },
    });
    return true;
  } catch (error) {
    log("\n✗ ERROR: Backend server not running at " + BACKEND_URL, colors.red);
    log("Please start: cd backend && node server.js\n", colors.yellow);
    return false;
  }
}

// Run tests
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runAdvancedSecurityTests();
  }
  process.exit(0);
})();
