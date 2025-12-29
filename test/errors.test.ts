/**
 * Tests for error handling utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  TripItError,
  AuthenticationError,
  NotFoundError,
  ProRequiredError,
  handleTripItError,
} from '../src/lib/errors.js';

describe('Error Classes', () => {
  describe('TripItError', () => {
    it('should create error with status code and details', () => {
      const error = new TripItError(500, 'Server error');
      expect(error.statusCode).toBe(500);
      expect(error.details).toBe('Server error');
      expect(error.message).toContain('500');
      expect(error.message).toContain('Server error');
    });
  });

  describe('AuthenticationError', () => {
    it('should have 401 status code', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('Token expired');
      expect(error.details).toBe('Token expired');
    });
  });

  describe('NotFoundError', () => {
    it('should have 404 status code', () => {
      const error = new NotFoundError('Trip', '123');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Trip');
      expect(error.message).toContain('123');
    });
  });

  describe('ProRequiredError', () => {
    it('should have 403 status code', () => {
      const error = new ProRequiredError('Flight status');
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Flight status');
      expect(error.message).toContain('TripIt Pro');
    });
  });
});

describe('handleTripItError', () => {
  it('should handle AuthenticationError', () => {
    const result = handleTripItError(new AuthenticationError());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('authentication expired');
    expect(result.content[0].text).toContain('re-authorize');
  });

  it('should handle NotFoundError', () => {
    const result = handleTripItError(new NotFoundError('Trip', '123'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Trip');
    expect(result.content[0].text).toContain('123');
  });

  it('should handle ProRequiredError', () => {
    const result = handleTripItError(new ProRequiredError('Flight status'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('TripIt Pro');
  });

  it('should handle generic TripItError', () => {
    const result = handleTripItError(new TripItError(429, 'Rate limited'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Rate limited');
  });

  it('should handle unknown errors', () => {
    const result = handleTripItError(new Error('Random error'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unexpected error');
  });

  it('should handle non-Error objects', () => {
    const result = handleTripItError('string error');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unexpected error');
  });
});
