/**
 * Unit tests for time-parsing module
 *
 * Note: These tests use mocks for DuckDB since we're testing the logic,
 * not the actual database operations. Integration tests would cover
 * the actual DuckDB interaction.
 */

import { createParsedView } from "../time-parsing"
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"

describe("time-parsing", () => {
  let mockDB: jest.Mocked<AsyncDuckDB>
  let mockConnection: any

  beforeEach(() => {
    // Create a mock connection
    mockConnection = {
      query: jest.fn(),
      close: jest.fn(),
    }

    // Create a mock database
    mockDB = {
      connect: jest.fn().mockResolvedValue(mockConnection),
    } as any
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createParsedView", () => {
    it("should create a view with original columns when no date candidates exist", async () => {
      // Mock schema with no date-like column names
      mockConnection.query.mockResolvedValueOnce({
        toArray: () => [
          { name: "id", type: "INTEGER" },
          { name: "name", type: "VARCHAR" },
          { name: "value", type: "DOUBLE" },
        ],
      })

      // Mock the CREATE VIEW query
      mockConnection.query.mockResolvedValueOnce({})

      const result = await createParsedView(mockDB, "t_raw", "t_parsed")

      expect(result).toEqual([])
      expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("PRAGMA table_info"))
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE OR REPLACE VIEW t_parsed"),
      )
      expect(mockConnection.close).toHaveBeenCalled()
    })

    it("should skip columns that are already DATE or TIMESTAMP type", async () => {
      // Mock schema with existing timestamp column
      mockConnection.query.mockResolvedValueOnce({
        toArray: () => [
          { name: "id", type: "INTEGER" },
          { name: "created_at", type: "TIMESTAMP" },
          { name: "date_field", type: "DATE" },
        ],
      })

      mockConnection.query.mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toEqual([])
      // Should not test parsing for DATE/TIMESTAMP columns
      expect(mockConnection.query).toHaveBeenCalledTimes(2) // schema + CREATE VIEW
    })

    it("should detect and parse date candidate columns with high success rate", async () => {
      // Mock schema with date candidate columns
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [
            { name: "id", type: "INTEGER" },
            { name: "created_date", type: "VARCHAR" },
          ],
        })
        // Mock COUNT total non-null
        .mockResolvedValueOnce({
          toArray: () => [{ total: 100 }],
        })
        // Mock COUNT successfully parsed
        .mockResolvedValueOnce({
          toArray: () => [{ parsed: 95 }],
        })
        // Mock CREATE VIEW
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toContain("created_date_date")
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('TRY_CAST("created_date" AS TIMESTAMP)'),
      )
    })

    it("should add '_ts' suffix for columns with 'time' in name", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [{ name: "timestamp_col", type: "VARCHAR" }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ total: 100 }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ parsed: 90 }],
        })
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toContain("timestamp_col_ts")
    })

    it("should add '_date' suffix for columns without 'time' in name", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [{ name: "created_date", type: "VARCHAR" }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ total: 100 }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ parsed: 85 }],
        })
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toContain("created_date_date")
    })

    it("should not parse columns with success rate below 80%", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [{ name: "date_field", type: "VARCHAR" }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ total: 100 }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ parsed: 75 }], // 75% success rate
        })
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toEqual([])
      // Should still create view with original column
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE OR REPLACE VIEW"),
      )
    })

    it("should handle multiple date candidate columns", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [
            { name: "id", type: "INTEGER" },
            { name: "created_date", type: "VARCHAR" },
            { name: "updated_timestamp", type: "VARCHAR" },
            { name: "name", type: "VARCHAR" }, // Not a date candidate
          ],
        })
        // created_date tests
        .mockResolvedValueOnce({
          toArray: () => [{ total: 100 }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ parsed: 95 }],
        })
        // updated_timestamp tests
        .mockResolvedValueOnce({
          toArray: () => [{ total: 100 }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ parsed: 88 }],
        })
        // CREATE VIEW
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toHaveLength(2)
      expect(result).toContain("created_date_date")
      expect(result).toContain("updated_timestamp_ts")
    })

    it("should handle columns with zero non-null values", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [{ name: "date_field", type: "VARCHAR" }],
        })
        .mockResolvedValueOnce({
          toArray: () => [{ total: 0 }],
        })
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toEqual([])
    })

    it("should handle parsing errors gracefully", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [{ name: "date_field", type: "VARCHAR" }],
        })
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce({})

      const result = await createParsedView(mockDB)

      expect(result).toEqual([])
      // Should still create view even if parsing test fails
      expect(mockConnection.close).toHaveBeenCalled()
    })

    it("should close connection even if error occurs", async () => {
      mockConnection.query.mockRejectedValueOnce(new Error("Database error"))

      await expect(createParsedView(mockDB)).rejects.toThrow("Database error")

      expect(mockConnection.close).toHaveBeenCalled()
    })

    it("should recognize various date-like column names", async () => {
      const dateColumns = [
        "date",
        "time",
        "timestamp",
        "dt",
        "created",
        "updated",
        "year",
        "month",
        "day",
        "created_at",
        "updated_at",
        "order_date",
        "event_time",
      ]

      for (const colName of dateColumns) {
        jest.clearAllMocks()

        mockConnection.query
          .mockResolvedValueOnce({
            toArray: () => [{ name: colName, type: "VARCHAR" }],
          })
          .mockResolvedValueOnce({
            toArray: () => [{ total: 100 }],
          })
          .mockResolvedValueOnce({
            toArray: () => [{ parsed: 90 }],
          })
          .mockResolvedValueOnce({})

        const result = await createParsedView(mockDB)

        expect(result.length).toBeGreaterThan(0)
      }
    })

    it("should use custom table and view names", async () => {
      mockConnection.query
        .mockResolvedValueOnce({
          toArray: () => [{ name: "id", type: "INTEGER" }],
        })
        .mockResolvedValueOnce({})

      await createParsedView(mockDB, "custom_source", "custom_view")

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("PRAGMA table_info('custom_source')"),
      )
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE OR REPLACE VIEW custom_view"),
      )
    })
  })
})
