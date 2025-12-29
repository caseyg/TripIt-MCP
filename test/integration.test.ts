/**
 * Integration tests for the Hono app endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import app from '../src/index.js';

describe('App Endpoints', () => {
  describe('GET /', () => {
    it('should return the landing page', async () => {
      const response = await app.request('/', {}, env);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('TripIt MCP Server');
      expect(html).toContain('Connect TripIt Account');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.request('/health', {}, env);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: 'ok', service: 'tripit-mcp' });
    });
  });

  describe('POST /mcp', () => {
    it('should reject requests without Authorization header', async () => {
      const response = await app.request('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      }, env);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.message).toContain('Authorization');
    });

    it('should reject invalid bearer tokens', async () => {
      const response = await app.request('/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-user-id',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      }, env);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.message).toContain('Invalid or expired');
    });

    it('should reject malformed JSON', async () => {
      // First, we need to simulate a valid user in KV
      await env.TOKENS.put('user:test-user:access_token', 'token');
      await env.TOKENS.put('user:test-user:access_token_secret', 'secret');

      const response = await app.request('/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-user',
        },
        body: 'not valid json',
      }, env);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe(-32700);
    });
  });

  describe('GET /oauth/callback', () => {
    it('should reject missing parameters', async () => {
      const response = await app.request('/oauth/callback', {}, env);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Missing OAuth parameters');
    });

    it('should reject expired state', async () => {
      const response = await app.request(
        '/oauth/callback?state=expired&oauth_token=token&oauth_verifier=verifier',
        {},
        env
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('expired');
    });
  });
});

describe('CORS', () => {
  it('should include CORS headers in responses', async () => {
    const response = await app.request('/health', {}, env);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should handle OPTIONS preflight requests', async () => {
    const response = await app.request('/mcp', {
      method: 'OPTIONS',
    }, env);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});
