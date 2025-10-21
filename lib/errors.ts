/**
 * Error types and type guards for the application
 * Provides structured error handling with specific error types
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * File validation errors
 */
export class FileValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'FILE_VALIDATION_ERROR', 400, details)
  }
}

/**
 * SQL validation errors
 */
export class SQLValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'SQL_VALIDATION_ERROR', 400, details)
  }
}

/**
 * DuckDB query execution errors
 */
export class QueryExecutionError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'QUERY_EXECUTION_ERROR', 500, details)
  }
}

/**
 * Data parsing errors
 */
export class DataParsingError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATA_PARSING_ERROR', 500, details)
  }
}

/**
 * API errors (OpenAI, external services)
 */
export class APIError extends AppError {
  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message, 'API_ERROR', statusCode, details)
  }
}

/**
 * Schema validation errors
 */
export class SchemaValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'SCHEMA_VALIDATION_ERROR', 400, details)
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timed out', details?: unknown) {
    super(message, 'TIMEOUT_ERROR', 408, details)
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Type guard to check if an error is a FileValidationError
 */
export function isFileValidationError(error: unknown): error is FileValidationError {
  return error instanceof FileValidationError
}

/**
 * Type guard to check if an error is a SQLValidationError
 */
export function isSQLValidationError(error: unknown): error is SQLValidationError {
  return error instanceof SQLValidationError
}

/**
 * Type guard to check if an error is a QueryExecutionError
 */
export function isQueryExecutionError(error: unknown): error is QueryExecutionError {
  return error instanceof QueryExecutionError
}

/**
 * Type guard to check if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message
  }
  if (isError(error)) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

/**
 * Get status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode
  }
  return 500
}

/**
 * Format error for API response
 */
export interface ErrorResponse {
  error: {
    message: string
    code: string
    statusCode: number
    details?: unknown
  }
}

export function formatErrorResponse(error: unknown): ErrorResponse {
  if (isAppError(error)) {
    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      },
    }
  }

  if (isError(error)) {
    return {
      error: {
        message: error.message,
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      },
    }
  }

  return {
    error: {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    },
  }
}

/**
 * Type guard for checking if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj
}

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard for checking if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * Type guard for checking if a value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Type guard for checking if a value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined
}
