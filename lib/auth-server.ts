// Server-side authentication utilities
import { db } from "../db/client";
import { users, sessions, userRoles } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import * as crypto from "crypto";

// Simple JWT-like token generation (in production, use a proper JWT library)
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Hash password using crypto
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

// Verify password
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(":");
  if (!salt || !hash) return false;
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}

// Create a new user
export async function createUser(email: string, password: string, fullName?: string) {
  const passwordHash = hashPassword(password);
  
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName,
      emailVerified: false,
    })
    .returning();

  // Create default role
  await db.insert(userRoles).values({
    userId: user.id,
    role: "user",
  });

  return user;
}

// Create a session for a user
export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      token,
      expiresAt: expiresAt.toISOString(),
    })
    .returning();

  return session;
}

// Verify a token and return the user
export async function verifyToken(token: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date().toISOString())
      )
    )
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return user || null;
}

// Delete a session (logout)
export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

// Get user by email
export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  return user || null;
}

// Get user role
export async function getUserRole(userId: string) {
  const [role] = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);

  return role?.role || "user";
}

// Check if user is admin
export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "admin";
}

// Extract token from Authorization header
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  return null;
}

// Update user's last login
export async function updateLastLogin(userId: string) {
  await db
    .update(users)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(users.id, userId));
}

