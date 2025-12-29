/**
 * TripIt MCP Server - Cloudflare Workers Entry Point
 *
 * Endpoints:
 * - GET  /              Landing page
 * - GET  /health        Health check
 * - GET  /oauth/start   Begin OAuth 1.0a flow
 * - GET  /oauth/callback Handle TripIt callback
 * - POST /mcp           MCP JSON-RPC endpoint
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TripItOAuth } from './tripit/oauth.js';
import { TripItClient } from './tripit/client.js';
import { handleMCPRequest } from './mcp/server.js';

// ============================================================================
// Types
// ============================================================================

type Bindings = {
  TOKENS: KVNamespace;
  TRIPIT_CONSUMER_KEY: string;
  TRIPIT_CONSUMER_SECRET: string;
  TRIPIT_API_BASE: string;
};

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono<{ Bindings: Bindings }>();

// CORS for MCP clients
app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
    exposeHeaders: ['mcp-session-id'],
  })
);

// ============================================================================
// Landing Page
// ============================================================================

app.get('/', (c) => {
  const baseUrl = new URL(c.req.url).origin;

  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TripIt MCP Server</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
      line-height: 1.6;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 24px;
    }
    h1 { color: #0066cc; margin-top: 0; }
    h2 { color: #333; margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 8px; }
    code {
      background: #f1f3f4;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.85em;
    }
    .btn {
      display: inline-block;
      background: #0066cc;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn:hover { background: #0052a3; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .tool {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #0066cc;
    }
    .tool code { background: none; padding: 0; font-weight: 600; }
    .tool small { color: #666; display: block; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TripIt MCP Server</h1>
    <p>A Model Context Protocol server for managing TripIt travel data with AI assistants.</p>
    <a href="/oauth/start" class="btn">Connect TripIt Account</a>
  </div>

  <div class="card">
    <h2>Quick Start</h2>
    <ol>
      <li>Click <strong>Connect TripIt Account</strong> above</li>
      <li>Authorize access to your TripIt data</li>
      <li>Copy your User ID from the success page</li>
      <li>Configure your MCP client (see below)</li>
    </ol>
  </div>

  <div class="card">
    <h2>Claude Desktop Configuration</h2>
    <p>Add this to your <code>claude_desktop_config.json</code>:</p>
    <pre>{
  "mcpServers": {
    "tripit": {
      "url": "${baseUrl}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_USER_ID"
      }
    }
  }
}</pre>
  </div>

  <div class="card">
    <h2>Available Tools</h2>
    <div class="tools-grid">
      <div class="tool">
        <code>tripit_list_trips</code>
        <small>List upcoming and past trips</small>
      </div>
      <div class="tool">
        <code>tripit_get_trip</code>
        <small>Get trip details with all objects</small>
      </div>
      <div class="tool">
        <code>tripit_create_trip</code>
        <small>Create a new trip container</small>
      </div>
      <div class="tool">
        <code>tripit_create_flight</code>
        <small>Add flight segments</small>
      </div>
      <div class="tool">
        <code>tripit_create_hotel</code>
        <small>Add hotel reservation</small>
      </div>
      <div class="tool">
        <code>tripit_create_car</code>
        <small>Add car rental</small>
      </div>
      <div class="tool">
        <code>tripit_create_activity</code>
        <small>Add activity or event</small>
      </div>
      <div class="tool">
        <code>tripit_get_flight_status</code>
        <small>Real-time status (Pro)</small>
      </div>
      <div class="tool">
        <code>tripit_list_points_programs</code>
        <small>Loyalty programs (Pro)</small>
      </div>
      <div class="tool">
        <code>tripit_get_profile</code>
        <small>User profile info</small>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>API Endpoints</h2>
    <ul>
      <li><code>GET /</code> - This page</li>
      <li><code>GET /health</code> - Health check</li>
      <li><code>GET /oauth/start</code> - Begin OAuth flow</li>
      <li><code>POST /mcp</code> - MCP JSON-RPC endpoint</li>
    </ul>
  </div>
</body>
</html>
  `);
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'tripit-mcp' });
});

// ============================================================================
// OAuth Flow
// ============================================================================

app.get('/oauth/start', async (c) => {
  const oauth = new TripItOAuth(c.env.TRIPIT_CONSUMER_KEY, c.env.TRIPIT_CONSUMER_SECRET);

  const callbackUrl = new URL('/oauth/callback', c.req.url).toString();

  try {
    const { token, tokenSecret } = await oauth.getRequestToken(callbackUrl);

    // Store request token with state for callback
    const state = crypto.randomUUID();
    await c.env.TOKENS.put(
      `oauth:${state}:request_token`,
      JSON.stringify({ token, tokenSecret }),
      { expirationTtl: 600 } // 10 minutes
    );

    const authUrl = oauth.getAuthorizationUrl(token);
    const fullAuthUrl = `${authUrl}&oauth_callback=${encodeURIComponent(callbackUrl + '?state=' + state)}`;

    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to TripIt...</title>
  <meta http-equiv="refresh" content="0;url=${fullAuthUrl}">
</head>
<body>
  <p>Redirecting to TripIt for authorization...</p>
  <p>If not redirected, <a href="${fullAuthUrl}">click here</a>.</p>
</body>
</html>
    `);
  } catch (error) {
    console.error('OAuth start error:', error);
    return c.json({ error: 'Failed to start OAuth flow' }, 500);
  }
});

app.get('/oauth/callback', async (c) => {
  const state = c.req.query('state');
  const oauthToken = c.req.query('oauth_token');
  const oauthVerifier = c.req.query('oauth_verifier');

  if (!state || !oauthToken || !oauthVerifier) {
    return c.json({ error: 'Missing OAuth parameters' }, 400);
  }

  // Retrieve stored request token
  const stored = await c.env.TOKENS.get(`oauth:${state}:request_token`);
  if (!stored) {
    return c.json({ error: 'OAuth session expired. Please try again.' }, 400);
  }

  const { token, tokenSecret } = JSON.parse(stored);

  const oauth = new TripItOAuth(c.env.TRIPIT_CONSUMER_KEY, c.env.TRIPIT_CONSUMER_SECRET);

  try {
    const accessTokens = await oauth.getAccessToken(token, tokenSecret, oauthVerifier);

    // Generate user ID and store tokens
    const userId = crypto.randomUUID();

    await Promise.all([
      c.env.TOKENS.put(`user:${userId}:access_token`, accessTokens.token),
      c.env.TOKENS.put(`user:${userId}:access_token_secret`, accessTokens.tokenSecret),
      c.env.TOKENS.delete(`oauth:${state}:request_token`),
    ]);

    const baseUrl = new URL(c.req.url).origin;

    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>TripIt Connected!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { color: #0a0; margin-top: 0; }
    code {
      background: #f1f3f4;
      padding: 4px 12px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      display: block;
      margin: 8px 0;
      word-break: break-all;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.85em;
    }
    .copy-btn {
      background: #0066cc;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .copy-btn:hover { background: #0052a3; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TripIt Connected!</h1>
    <p>Your TripIt account is now linked. Save your User ID below:</p>

    <strong>User ID:</strong>
    <code id="userId">${userId}</code>
    <button class="copy-btn" onclick="navigator.clipboard.writeText('${userId}')">Copy User ID</button>

    <h3 style="margin-top: 24px;">Claude Desktop Configuration</h3>
    <pre>{
  "mcpServers": {
    "tripit": {
      "url": "${baseUrl}/mcp",
      "headers": {
        "Authorization": "Bearer ${userId}"
      }
    }
  }
}</pre>

    <p style="color: #666; margin-top: 16px;">
      Add this to your <code style="display: inline;">claude_desktop_config.json</code> file.
    </p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json({ error: 'Failed to complete OAuth flow' }, 500);
  }
});

// ============================================================================
// MCP Endpoint
// ============================================================================

app.post('/mcp', async (c) => {
  // Extract user ID from Authorization header
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Missing Authorization header. Use: Bearer <user_id>' },
      },
      401
    );
  }

  const userId = authHeader.slice(7);

  // Retrieve stored tokens
  const [accessToken, accessTokenSecret] = await Promise.all([
    c.env.TOKENS.get(`user:${userId}:access_token`),
    c.env.TOKENS.get(`user:${userId}:access_token_secret`),
  ]);

  if (!accessToken || !accessTokenSecret) {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid or expired session. Please re-authorize at /oauth/start' },
      },
      401
    );
  }

  // Create TripIt client
  const oauth = new TripItOAuth(c.env.TRIPIT_CONSUMER_KEY, c.env.TRIPIT_CONSUMER_SECRET);
  const client = new TripItClient(oauth, accessToken, accessTokenSecret);

  // Parse and handle MCP request
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      },
      400
    );
  }

  const response = await handleMCPRequest(client, body as {
    jsonrpc: '2.0';
    id: string | number | null;
    method: string;
    params?: Record<string, unknown>;
  });

  return c.json(response);
});

// ============================================================================
// Export
// ============================================================================

export default app;
