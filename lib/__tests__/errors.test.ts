import {
  AppError,
  FileValidationError,
  SQLValidationError,
  QueryExecutionError,
  DataParsingError,
  APIError,
  SchemaValidationError,
  TimeoutError,
  isAppError,
  isFileValidationError,
  isSQLValidationError,
  isQueryExecutionError,
  isAPIError,
  isError,
  getErrorMessage,
  getErrorStatusCode,
  formatErrorResponse,
  hasProperty,
  isString,
  isNumber,
  isObject,
  isArray,
  isNullOrUndefined,
} from "../errors"

describe("errors", () => {
  describe("Error Classes", () => {
    it("should create AppError with correct properties", () => {
      const error = new AppError("Test error", "TEST_CODE", 400, { detail: "test" })

      expect(error.message).toBe("Test error")
      expect(error.code).toBe("TEST_CODE")
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual({ detail: "test" })
      expect(error.name).toBe("AppError")
    })

    it("should create FileValidationError", () => {
      const error = new FileValidationError("File too large")

      expect(error.message).toBe("File too large")
      expect(error.code).toBe("FILE_VALIDATION_ERROR")
      expect(error.statusCode).toBe(400)
      expect(error).toBeInstanceOf(AppError)
    })

    it("should create SQLValidationError", () => {
      const error = new SQLValidationError("Invalid SQL", { sql: "DROP TABLE" })

      expect(error.message).toBe("Invalid SQL")
      expect(error.code).toBe("SQL_VALIDATION_ERROR")
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual({ sql: "DROP TABLE" })
    })

    it("should create QueryExecutionError", () => {
      const error = new QueryExecutionError("Query failed")

      expect(error.code).toBe("QUERY_EXECUTION_ERROR")
      expect(error.statusCode).toBe(500)
    })

    it("should create APIError with custom status code", () => {
      const error = new APIError("API timeout", 503)

      expect(error.code).toBe("API_ERROR")
      expect(error.statusCode).toBe(503)
    })

    it("should create TimeoutError with default message", () => {
      const error = new TimeoutError()

      expect(error.message).toBe("Operation timed out")
      expect(error.code).toBe("TIMEOUT_ERROR")
      expect(error.statusCode).toBe(408)
    })
  })

  describe("Type Guards", () => {
    describe("isAppError", () => {
      it("should return true for AppError instances", () => {
        const error = new AppError("test", "TEST")
        expect(isAppError(error)).toBe(true)
      })

      it("should return true for subclass instances", () => {
        const error = new FileValidationError("test")
        expect(isAppError(error)).toBe(true)
      })

      it("should return false for regular Error", () => {
        const error = new Error("test")
        expect(isAppError(error)).toBe(false)
      })

      it("should return false for non-errors", () => {
        expect(isAppError("error")).toBe(false)
        expect(isAppError(null)).toBe(false)
      })
    })

    describe("isFileValidationError", () => {
      it("should identify FileValidationError", () => {
        const error = new FileValidationError("test")
        expect(isFileValidationError(error)).toBe(true)
      })

      it("should return false for other errors", () => {
        const error = new SQLValidationError("test")
        expect(isFileValidationError(error)).toBe(false)
      })
    })

    describe("isError", () => {
      it("should return true for Error instances", () => {
        expect(isError(new Error("test"))).toBe(true)
        expect(isError(new AppError("test", "TEST"))).toBe(true)
      })

      it("should return false for non-errors", () => {
        expect(isError("error")).toBe(false)
        expect(isError({ message: "error" })).toBe(false)
      })
    })
  })

  describe("Error Utilities", () => {
    describe("getErrorMessage", () => {
      it("should extract message from AppError", () => {
        const error = new AppError("Test message", "TEST")
        expect(getErrorMessage(error)).toBe("Test message")
      })

      it("should extract message from Error", () => {
        const error = new Error("Standard error")
        expect(getErrorMessage(error)).toBe("Standard error")
      })

      it("should return string directly", () => {
        expect(getErrorMessage("String error")).toBe("String error")
      })

      it("should return default message for unknown errors", () => {
        expect(getErrorMessage(null)).toBe("An unknown error occurred")
        expect(getErrorMessage({ foo: "bar" })).toBe("An unknown error occurred")
      })
    })

    describe("getErrorStatusCode", () => {
      it("should extract status code from AppError", () => {
        const error = new AppError("test", "TEST", 404)
        expect(getErrorStatusCode(error)).toBe(404)
      })

      it("should return 500 for non-AppError", () => {
        expect(getErrorStatusCode(new Error("test"))).toBe(500)
        expect(getErrorStatusCode("error")).toBe(500)
      })
    })

    describe("formatErrorResponse", () => {
      it("should format AppError correctly", () => {
        const error = new AppError("Test error", "TEST_CODE", 400, { field: "name" })
        const response = formatErrorResponse(error)

        expect(response).toEqual({
          error: {
            message: "Test error",
            code: "TEST_CODE",
            statusCode: 400,
            details: { field: "name" },
          },
        })
      })

      it("should format regular Error", () => {
        const error = new Error("Standard error")
        const response = formatErrorResponse(error)

        expect(response).toEqual({
          error: {
            message: "Standard error",
            code: "INTERNAL_ERROR",
            statusCode: 500,
          },
        })
      })

      it("should format unknown errors", () => {
        const response = formatErrorResponse("something went wrong")

        expect(response).toEqual({
          error: {
            message: "An unknown error occurred",
            code: "UNKNOWN_ERROR",
            statusCode: 500,
          },
        })
      })
    })
  })

  describe("General Type Guards", () => {
    describe("hasProperty", () => {
      it("should return true if object has property", () => {
        const obj = { name: "test", value: 123 }
        expect(hasProperty(obj, "name")).toBe(true)
        expect(hasProperty(obj, "value")).toBe(true)
      })

      it("should return false if object doesn't have property", () => {
        const obj = { name: "test" }
        expect(hasProperty(obj, "missing")).toBe(false)
      })

      it("should return false for non-objects", () => {
        expect(hasProperty(null, "name")).toBe(false)
        expect(hasProperty("string", "name")).toBe(false)
      })
    })

    describe("isString", () => {
      it("should return true for strings", () => {
        expect(isString("hello")).toBe(true)
        expect(isString("")).toBe(true)
      })

      it("should return false for non-strings", () => {
        expect(isString(123)).toBe(false)
        expect(isString(null)).toBe(false)
      })
    })

    describe("isNumber", () => {
      it("should return true for numbers", () => {
        expect(isNumber(123)).toBe(true)
        expect(isNumber(0)).toBe(true)
        expect(isNumber(-5.5)).toBe(true)
      })

      it("should return false for NaN", () => {
        expect(isNumber(NaN)).toBe(false)
      })

      it("should return false for non-numbers", () => {
        expect(isNumber("123")).toBe(false)
        expect(isNumber(null)).toBe(false)
      })
    })

    describe("isObject", () => {
      it("should return true for objects", () => {
        expect(isObject({})).toBe(true)
        expect(isObject({ key: "value" })).toBe(true)
      })

      it("should return false for null", () => {
        expect(isObject(null)).toBe(false)
      })

      it("should return false for arrays", () => {
        expect(isObject([])).toBe(false)
      })

      it("should return false for primitives", () => {
        expect(isObject("string")).toBe(false)
        expect(isObject(123)).toBe(false)
      })
    })

    describe("isArray", () => {
      it("should return true for arrays", () => {
        expect(isArray([])).toBe(true)
        expect(isArray([1, 2, 3])).toBe(true)
      })

      it("should return false for non-arrays", () => {
        expect(isArray({})).toBe(false)
        expect(isArray("array")).toBe(false)
      })
    })

    describe("isNullOrUndefined", () => {
      it("should return true for null and undefined", () => {
        expect(isNullOrUndefined(null)).toBe(true)
        expect(isNullOrUndefined(undefined)).toBe(true)
      })

      it("should return false for other values", () => {
        expect(isNullOrUndefined(0)).toBe(false)
        expect(isNullOrUndefined("")).toBe(false)
        expect(isNullOrUndefined(false)).toBe(false)
      })
    })
  })
})
