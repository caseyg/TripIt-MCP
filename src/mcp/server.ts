/**
 * MCP server setup for TripIt.
 *
 * Handles JSON-RPC protocol for MCP communication.
 */

import { getToolDefinitions, handleToolCall } from './tools/index.js';
import type { TripItClient } from '../tripit/client.js';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const SERVER_INFO = {
  name: 'tripit-mcp',
  version: '1.0.0',
};

const PROTOCOL_VERSION = '2024-11-05';

export async function handleMCPRequest(
  client: TripItClient,
  request: MCPRequest
): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: {},
            },
            serverInfo: SERVER_INFO,
          },
        };

      case 'initialized':
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: getToolDefinitions(),
          },
        };

      case 'tools/call': {
        const toolParams = params as { name: string; arguments?: Record<string, unknown> } | undefined;
        if (!toolParams?.name) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Missing tool name' },
          };
        }

        const result = await handleToolCall(
          client,
          toolParams.name,
          toolParams.arguments ?? {}
        );

        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      }

      case 'ping':
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };

      case 'resources/list':
        // No resources implemented yet
        return {
          jsonrpc: '2.0',
          id,
          result: { resources: [] },
        };

      case 'prompts/list':
        // No prompts implemented
        return {
          jsonrpc: '2.0',
          id,
          result: { prompts: [] },
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
    console.error('MCP request error:', error);
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}
