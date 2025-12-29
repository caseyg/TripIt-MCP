/**
 * Tool registry - combines all TripIt MCP tools.
 */

import type { TripItClient } from '../../tripit/client.js';
import { tripTools, handleTripTool } from './trips.js';
import { objectTools, handleObjectTool } from './objects.js';
import { proTools, handleProTool } from './pro.js';

// Combined tool definitions for MCP registration
export const allTools = {
  ...tripTools,
  ...objectTools,
  ...proTools,
};

// Tool definitions formatted for MCP tools/list response
export function getToolDefinitions() {
  return Object.entries(allTools).map(([name, config]) => ({
    name,
    description: config.description,
    inputSchema: config.inputSchema,
  }));
}

// Route tool calls to appropriate handler
export async function handleToolCall(
  client: TripItClient,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Trip tools
  if (name in tripTools) {
    return handleTripTool(client, name, args);
  }

  // Object tools
  if (name in objectTools) {
    return handleObjectTool(client, name, args);
  }

  // Pro tools
  if (name in proTools) {
    return handleProTool(client, name, args);
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
}
