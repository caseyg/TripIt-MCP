/**
 * Error handling utilities for TripIt MCP server.
 */

export class TripItError extends Error {
  constructor(
    public statusCode: number,
    public details: string
  ) {
    super(`TripIt API error (${statusCode}): ${details}`);
    this.name = 'TripItError';
  }
}

export class AuthenticationError extends TripItError {
  constructor(details = 'Authentication failed') {
    super(401, details);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends TripItError {
  constructor(resource: string, id: string) {
    super(404, `${resource} with ID ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ProRequiredError extends TripItError {
  constructor(feature: string) {
    super(403, `${feature} requires TripIt Pro subscription`);
    this.name = 'ProRequiredError';
  }
}

export interface ToolErrorResult {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

export function handleTripItError(error: unknown): ToolErrorResult {
  if (error instanceof TripItError) {
    if (error.statusCode === 401) {
      return {
        content: [{ type: 'text', text: 'TripIt authentication expired. Please re-authorize at /oauth/start' }],
        isError: true,
      };
    }
    if (error.statusCode === 404) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    }
    if (error.statusCode === 403) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `TripIt error: ${error.details}` }],
      isError: true,
    };
  }

  console.error('Unexpected error:', error);
  return {
    content: [{ type: 'text', text: 'An unexpected error occurred. Please try again.' }],
    isError: true,
  };
}
