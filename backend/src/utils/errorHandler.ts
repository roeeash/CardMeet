/**
 * Error handling utility for API routes.
 * Maps errors to appropriate HTTP status codes and formats responses.
 */

/**
 * Maps error messages to HTTP status codes.
 * @param error - The error object or any thrown value
 * @returns HTTP status code (400, 401, 403, 404, 500)
 */
export function getStatusCode(error: unknown): number {
  const errorMessage = getErrorMessage(error);

  // 404 Not Found
  if (
    errorMessage.toLowerCase().includes('not found') ||
    errorMessage.toLowerCase().includes('does not exist')
  ) {
    return 404;
  }

  // 401 Unauthorized
  if (
    errorMessage.includes('Invalid credentials') ||
    errorMessage.includes('User not found or token invalid') ||
    errorMessage.includes('invalid token') ||
    errorMessage.includes('unauthorized')
  ) {
    return 401;
  }

  // 403 Forbidden
  if (
    errorMessage.includes('Cannot create deal: buyer and seller') ||
    errorMessage.includes('User is not a party to this deal') ||
    errorMessage.includes('not authorized') ||
    errorMessage.includes('forbidden')
  ) {
    return 403;
  }

  // 400 Bad Request
  if (
    errorMessage.includes('Price must be greater than 0') ||
    errorMessage.includes('Invalid') ||
    errorMessage.includes('required')
  ) {
    return 400;
  }

  // Default: 500 Internal Server Error
  return 500;
}

/**
 * Extracts error message from various error types.
 * @param error - The error object
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as any).message);
  }
  return String(error);
}

/**
 * Formats error response for API endpoints.
 * @param error - The error object
 * @returns Formatted error response object
 */
export function formatErrorResponse(error: unknown): { error: string } {
  const message = getErrorMessage(error);
  return { error: message };
}
