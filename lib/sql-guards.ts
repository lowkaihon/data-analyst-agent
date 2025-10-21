import { SQLValidationError } from "./errors"

/**
 * SQL sanitization and read-only enforcement
 */

const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "REPLACE",
  "MERGE",
  "GRANT",
  "REVOKE",
]

const FORBIDDEN_PATTERNS = [/;\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)/i, /--/, /\/\*/, /xp_/i, /sp_/i]

/**
 * Check if SQL is read-only (SELECT, WITH, PRAGMA only)
 */
export function isReadOnlySQL(sql: string): boolean {
  const normalized = sql.trim().toUpperCase()

  // Check for forbidden keywords at statement start
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (normalized.startsWith(keyword)) {
      return false
    }
  }

  // Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) {
      return false
    }
  }

  // Must start with SELECT, WITH, or PRAGMA
  return normalized.startsWith("SELECT") || normalized.startsWith("WITH") || normalized.startsWith("PRAGMA")
}

/**
 * Sanitize SQL by removing comments and normalizing whitespace
 */
export function sanitizeSQL(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

/**
 * Validate and sanitize SQL query
 * Throws SQLValidationError if SQL is not read-only
 */
export function validateSQL(sql: string): string {
  const sanitized = sanitizeSQL(sql)

  if (!sanitized) {
    throw new SQLValidationError("Empty SQL query")
  }

  if (!isReadOnlySQL(sanitized)) {
    throw new SQLValidationError("Only read-only queries (SELECT, WITH, PRAGMA) are allowed", {
      sql: sanitized,
    })
  }

  return sanitized
}
