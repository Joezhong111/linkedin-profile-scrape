// Script to create an admin user
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import * as crypto from "crypto";

// Load env
config({ path: existsSync(".env.local") ? ".env.local" : ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

async function createAdmin() {
  const pool = new Pool({
    connectionString,
    ssl: /supabase\.co|neon\.tech|aws/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    // Get email and password from command line args
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.error("Usage: node scripts/create-admin.js <email> <password>");
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    let userId;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`User ${email} already exists with ID: ${userId}`);
    } else {
      // Create user
      const passwordHash = hashPassword(password);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, email_verified) 
         VALUES ($1, $2, true) 
         RETURNING id`,
        [email.toLowerCase().trim(), passwordHash]
      );
      userId = result.rows[0].id;
      console.log(`Created user ${email} with ID: ${userId}`);
    }

    // Set admin role
    await pool.query(
      `INSERT INTO user_roles (user_id, role) 
       VALUES ($1, 'admin') 
       ON CONFLICT (user_id) 
       DO UPDATE SET role = 'admin'`,
      [userId]
    );

    console.log(`✅ User ${email} is now an admin!`);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();

