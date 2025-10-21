import { isReadOnlySQL, sanitizeSQL, validateSQL } from "../sql-guards"
import { SQLValidationError } from "../errors"

describe("sql-guards", () => {
  describe("sanitizeSQL", () => {
    it("should remove single-line comments", () => {
      const sql = "SELECT * FROM users -- get all users"
      expect(sanitizeSQL(sql)).toBe("SELECT * FROM users")
    })

    it("should remove multi-line comments", () => {
      const sql = "SELECT * /* this is a comment */ FROM users"
      expect(sanitizeSQL(sql)).toBe("SELECT * FROM users")
    })

    it("should normalize whitespace", () => {
      const sql = "SELECT   *    FROM     users"
      expect(sanitizeSQL(sql)).toBe("SELECT * FROM users")
    })

    it("should trim leading and trailing whitespace", () => {
      const sql = "  SELECT * FROM users  "
      expect(sanitizeSQL(sql)).toBe("SELECT * FROM users")
    })

    it("should handle multiple types of comments and whitespace", () => {
      const sql = `
        SELECT * -- comment
        FROM users /* another comment */
        WHERE   id  =  1
      `
      expect(sanitizeSQL(sql)).toBe("SELECT * FROM users WHERE id = 1")
    })
  })

  describe("isReadOnlySQL", () => {
    describe("valid read-only queries", () => {
      it("should allow SELECT queries", () => {
        expect(isReadOnlySQL("SELECT * FROM users")).toBe(true)
      })

      it("should allow WITH queries (CTEs)", () => {
        expect(isReadOnlySQL("WITH tmp AS (SELECT 1) SELECT * FROM tmp")).toBe(true)
      })

      it("should allow PRAGMA queries", () => {
        expect(isReadOnlySQL("PRAGMA table_info('users')")).toBe(true)
      })

      it("should allow SELECT with JOIN", () => {
        expect(isReadOnlySQL("SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id")).toBe(
          true,
        )
      })

      it("should allow SELECT with subqueries", () => {
        expect(isReadOnlySQL("SELECT * FROM (SELECT * FROM users) AS t")).toBe(true)
      })
    })

    describe("invalid write queries", () => {
      it("should reject INSERT queries", () => {
        expect(isReadOnlySQL("INSERT INTO users (name) VALUES ('John')")).toBe(false)
      })

      it("should reject UPDATE queries", () => {
        expect(isReadOnlySQL("UPDATE users SET name = 'John' WHERE id = 1")).toBe(false)
      })

      it("should reject DELETE queries", () => {
        expect(isReadOnlySQL("DELETE FROM users WHERE id = 1")).toBe(false)
      })

      it("should reject DROP queries", () => {
        expect(isReadOnlySQL("DROP TABLE users")).toBe(false)
      })

      it("should reject CREATE queries", () => {
        expect(isReadOnlySQL("CREATE TABLE users (id INT)")).toBe(false)
      })

      it("should reject ALTER queries", () => {
        expect(isReadOnlySQL("ALTER TABLE users ADD COLUMN email VARCHAR(255)")).toBe(false)
      })

      it("should reject TRUNCATE queries", () => {
        expect(isReadOnlySQL("TRUNCATE TABLE users")).toBe(false)
      })

      it("should reject REPLACE queries", () => {
        expect(isReadOnlySQL("REPLACE INTO users (id, name) VALUES (1, 'John')")).toBe(false)
      })

      it("should reject MERGE queries", () => {
        expect(isReadOnlySQL("MERGE INTO users USING source ON users.id = source.id")).toBe(false)
      })

      it("should reject GRANT queries", () => {
        expect(isReadOnlySQL("GRANT SELECT ON users TO user1")).toBe(false)
      })

      it("should reject REVOKE queries", () => {
        expect(isReadOnlySQL("REVOKE SELECT ON users FROM user1")).toBe(false)
      })
    })

    describe("SQL injection attempts", () => {
      it("should reject queries with multiple statements (using semicolon)", () => {
        expect(isReadOnlySQL("SELECT * FROM users; DROP TABLE users")).toBe(false)
      })

      it("should reject queries with comment indicators", () => {
        expect(isReadOnlySQL("SELECT * FROM users --")).toBe(false)
      })

      it("should reject queries with multi-line comment indicators", () => {
        expect(isReadOnlySQL("SELECT * FROM users /* comment */")).toBe(false)
      })

      it("should reject queries with xp_ stored procedures", () => {
        expect(isReadOnlySQL("SELECT * FROM users; xp_cmdshell 'dir'")).toBe(false)
      })

      it("should reject queries with sp_ stored procedures", () => {
        expect(isReadOnlySQL("SELECT * FROM users; sp_executesql 'SELECT 1'")).toBe(false)
      })
    })

    describe("edge cases", () => {
      it("should handle case insensitivity", () => {
        expect(isReadOnlySQL("select * from users")).toBe(true)
        expect(isReadOnlySQL("SeLeCt * FrOm users")).toBe(true)
      })

      it("should reject empty queries", () => {
        expect(isReadOnlySQL("")).toBe(false)
      })

      it("should reject queries that don't start with SELECT, WITH, or PRAGMA", () => {
        expect(isReadOnlySQL("EXPLAIN SELECT * FROM users")).toBe(false)
      })
    })
  })

  describe("validateSQL", () => {
    it("should return sanitized SQL for valid SELECT query", () => {
      const sql = "SELECT * FROM users -- comment"
      expect(validateSQL(sql)).toBe("SELECT * FROM users")
    })

    it("should return sanitized SQL for valid WITH query", () => {
      const sql = "  WITH tmp AS (SELECT 1) SELECT * FROM tmp  "
      expect(validateSQL(sql)).toBe("WITH tmp AS (SELECT 1) SELECT * FROM tmp")
    })

    it("should throw SQLValidationError for empty query", () => {
      expect(() => validateSQL("")).toThrow(SQLValidationError)
      expect(() => validateSQL("   ")).toThrow(SQLValidationError)
    })

    it("should throw SQLValidationError for INSERT query", () => {
      expect(() => validateSQL("INSERT INTO users (name) VALUES ('John')")).toThrow(
        SQLValidationError,
      )
    })

    it("should throw SQLValidationError for UPDATE query", () => {
      expect(() => validateSQL("UPDATE users SET name = 'John'")).toThrow(SQLValidationError)
    })

    it("should throw SQLValidationError for DELETE query", () => {
      expect(() => validateSQL("DELETE FROM users")).toThrow(SQLValidationError)
    })

    it("should throw SQLValidationError for DROP query", () => {
      expect(() => validateSQL("DROP TABLE users")).toThrow(SQLValidationError)
    })

    it("should throw SQLValidationError with error details", () => {
      try {
        validateSQL("DROP TABLE users")
        fail("Should have thrown error")
      } catch (error) {
        expect(error).toBeInstanceOf(SQLValidationError)
        if (error instanceof SQLValidationError) {
          expect(error.message).toContain("read-only")
          expect(error.details).toBeDefined()
        }
      }
    })

    it("should handle complex valid queries", () => {
      const sql = `
        WITH ranked_users AS (
          SELECT
            id,
            name,
            ROW_NUMBER() OVER (ORDER BY created_at DESC) as rank
          FROM users
        )
        SELECT * FROM ranked_users WHERE rank <= 10
      `
      const result = validateSQL(sql)
      expect(result).toContain("WITH ranked_users AS")
      expect(result).toContain("SELECT")
    })
  })
})
