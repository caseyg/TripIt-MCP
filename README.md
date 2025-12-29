# TripIt MCP Server

A Model Context Protocol (MCP) server for TripIt travel management, deployed on Cloudflare Workers.

## Features

- **16 MCP tools** for complete TripIt integration
- **OAuth 1.0a** authentication with web-based authorization flow
- **TripIt Pro** support for flight status, loyalty programs, and more
- **Cloudflare Workers** deployment for edge performance

## Quick Start

### 1. Deploy to Cloudflare

```bash
# Install dependencies
npm install

# Create KV namespace
wrangler kv:namespace create TOKENS
# Copy the ID to wrangler.toml

# Set secrets
wrangler secret put TRIPIT_CONSUMER_KEY
wrangler secret put TRIPIT_CONSUMER_SECRET

# Deploy
wrangler deploy
```

### 2. Authorize with TripIt

Visit `https://your-worker.workers.dev/oauth/start` and complete the TripIt authorization.

### 3. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tripit": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_USER_ID"
      }
    }
  }
}
```

## Available Tools

### Trip Management
| Tool | Description |
|------|-------------|
| `tripit_list_trips` | List upcoming and past trips |
| `tripit_get_trip` | Get trip details with all objects |
| `tripit_create_trip` | Create a new trip container |
| `tripit_update_trip` | Update trip details |
| `tripit_delete_trip` | Delete a trip |

### Travel Objects
| Tool | Description |
|------|-------------|
| `tripit_list_objects` | List objects by type (air, lodging, car, etc.) |
| `tripit_get_object` | Get specific object details |
| `tripit_create_flight` | Add flight segments |
| `tripit_create_hotel` | Add hotel reservation |
| `tripit_create_car` | Add car rental |
| `tripit_create_activity` | Add activity/event |
| `tripit_update_object` | Update any object |
| `tripit_delete_object` | Delete an object |

### Pro Features
| Tool | Description |
|------|-------------|
| `tripit_get_flight_status` | Real-time flight status |
| `tripit_list_points_programs` | Loyalty program balances |
| `tripit_get_profile` | User profile info |

## Development

```bash
# Run locally
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Landing page |
| `/health` | GET | Health check |
| `/oauth/start` | GET | Begin OAuth flow |
| `/oauth/callback` | GET | OAuth callback |
| `/mcp` | POST | MCP JSON-RPC endpoint |

## Architecture

```
src/
├── index.ts           # Hono app entry point
├── mcp/
│   ├── server.ts      # MCP request handling
│   └── tools/
│       ├── trips.ts   # Trip CRUD tools
│       ├── objects.ts # Travel object tools
│       ├── pro.ts     # Pro feature tools
│       └── index.ts   # Tool registry
├── tripit/
│   ├── client.ts      # TripIt API client
│   ├── oauth.ts       # OAuth 1.0a implementation
│   └── types.ts       # Type definitions
└── lib/
    └── errors.ts      # Error utilities
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TRIPIT_CONSUMER_KEY` | TripIt OAuth consumer key (secret) |
| `TRIPIT_CONSUMER_SECRET` | TripIt OAuth consumer secret (secret) |
| `TRIPIT_API_BASE` | TripIt API base URL (default: https://api.tripit.com/v1) |

### KV Namespace

The `TOKENS` KV namespace stores:
- `user:{userId}:access_token` - OAuth access tokens
- `user:{userId}:access_token_secret` - OAuth token secrets
- `oauth:{state}:request_token` - Temporary request tokens (TTL: 10 min)

## Notes

- OAuth 1.0a tokens **do not expire** unless revoked
- TripIt Pro features gracefully degrade for non-Pro accounts
- Rate limiting: ~2.5 requests/second with exponential backoff

## License

MIT
