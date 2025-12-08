/**
 * Create Master Test User for fabrix
 *
 * This script creates a test user in your Supabase database
 * for testing the extension locally.
 *
 * IMPORTANT: Make sure you have:
 * 1. Created .env file with your Supabase credentials
 * 2. Run the database schema (backend/database/schema.sql) in Supabase
 *
 * Usage: node create-test-user.js
 */

require("dotenv").config({ path: "../.env" });
const fetch = require("node-fetch");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Master test user credentials
const MASTER_USER = {
  email: "test@fabrix.dev",
  password: "FabrixTest2024!",
};

async function createTestUser() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║     fabrix - Create Master Test User        ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Check environment variables
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERROR: Missing Supabase credentials in .env file");
    console.error("\nPlease create a .env file with:");
    console.error("  SUPABASE_URL=https://your-project.supabase.co");
    console.error("  SUPABASE_KEY=your-supabase-anon-key");
    console.error("\nSee .env.example for reference\n");
    process.exit(1);
  }

  console.log("📋 Configuration:");
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Email: ${MASTER_USER.email}`);
  console.log(`  Password: ${MASTER_USER.password}\n`);

  try {
    console.log("🔄 Creating user in Supabase Auth...");

    // Create user via Supabase Auth API
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({
        email: MASTER_USER.email,
        password: MASTER_USER.password,
        email_confirm: true, // Auto-confirm email for testing
      }),
    });

    if (!authResponse.ok) {
      const error = await authResponse.json();

      if (error.msg && error.msg.includes("already registered")) {
        console.log("⚠️  User already exists!");
        console.log("\nYou can sign in with:");
        console.log(`  Email: ${MASTER_USER.email}`);
        console.log(`  Password: ${MASTER_USER.password}\n`);

        // Try to get user info
        await getUserInfo();
        process.exit(0);
      } else {
        throw new Error(error.msg || error.error_description || "Signup failed");
      }
    }

    const authData = await authResponse.json();
    console.log("✅ User created in Supabase Auth!");
    console.log(`   User ID: ${authData.user.id}`);

    // The database trigger should auto-create the user profile
    // Wait a bit for trigger to execute
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify user profile was created
    console.log("\n🔄 Verifying user profile...");
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${authData.user.id}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        console.log("✅ User profile created!");
        console.log(`   Subscription: ${profile.subscription_tier}`);
        console.log(`   Scans Remaining: ${profile.scans_remaining}`);
      } else {
        console.log("⚠️  User profile not found - check database trigger");
      }
    }

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║           ✅ SUCCESS!                         ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    console.log("📝 Master Test User Credentials:");
    console.log(`   Email:    ${MASTER_USER.email}`);
    console.log(`   Password: ${MASTER_USER.password}\n`);

    console.log("🎯 Next Steps:");
    console.log("   1. Start the backend: cd backend && node server.js");
    console.log("   2. Load extension in Chrome (chrome://extensions)");
    console.log("   3. Click extension icon and sign in with credentials above");
    console.log("   4. Start scanning products!\n");

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error("\nTroubleshooting:");
    console.error("  1. Check your .env file has correct Supabase credentials");
    console.error("  2. Verify you've run the database schema in Supabase SQL editor");
    console.error("  3. Check Supabase Auth is enabled in your project settings");
    console.error("  4. Make sure you're using the anon/public key, not service key\n");
    process.exit(1);
  }
}

async function getUserInfo() {
  try {
    // Try to sign in to get user info
    const signinResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          email: MASTER_USER.email,
          password: MASTER_USER.password,
        }),
      }
    );

    if (signinResponse.ok) {
      const signinData = await signinResponse.json();

      const profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${signinData.user.id}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      if (profileResponse.ok) {
        const profiles = await profileResponse.json();
        if (profiles && profiles.length > 0) {
          const profile = profiles[0];
          console.log("\n📊 Current User Status:");
          console.log(`   User ID: ${profile.id}`);
          console.log(`   Email: ${profile.email}`);
          console.log(`   Subscription: ${profile.subscription_tier}`);
          console.log(`   Scans Remaining: ${profile.scans_remaining}`);
          console.log(`   Scans Used Today: ${profile.scans_used_today}`);
          console.log(`   Flagged: ${profile.is_flagged ? "Yes ⚠️" : "No ✅"}`);
        }
      }
    }
  } catch (error) {
    // Ignore errors here
  }
}

// Run the script
createTestUser();
