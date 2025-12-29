/**
 * Tests for MCP server request handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMCPRequest } from '../src/mcp/server.js';
import type { TripItClient } from '../src/tripit/client.js';

// Mock TripIt client
function createMockClient(overrides: Partial<TripItClient> = {}): TripItClient {
  return {
    listTrips: vi.fn().mockResolvedValue({ Trip: [] }),
    getTrip: vi.fn().mockResolvedValue({ Trip: { id: '123', display_name: 'Test Trip' } }),
    createTrip: vi.fn().mockResolvedValue({ Trip: { id: '456' } }),
    updateTrip: vi.fn().mockResolvedValue({ Trip: { id: '123' } }),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    listObjects: vi.fn().mockResolvedValue({ AirObject: [] }),
    getObject: vi.fn().mockResolvedValue({}),
    createObject: vi.fn().mockResolvedValue({}),
    updateObject: vi.fn().mockResolvedValue({}),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    createFlight: vi.fn().mockResolvedValue({}),
    createHotel: vi.fn().mockResolvedValue({}),
    createCar: vi.fn().mockResolvedValue({}),
    createActivity: vi.fn().mockResolvedValue({}),
    getFlightStatus: vi.fn().mockResolvedValue({ AirObject: { Segment: [] } }),
    listPointsPrograms: vi.fn().mockResolvedValue({ PointsProgram: [] }),
    getProfile: vi.fn().mockResolvedValue({ Profile: {} }),
    ...overrides,
  } as unknown as TripItClient;
}

describe('MCP Server', () => {
  describe('initialize', () => {
    it('should respond with server info and capabilities', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect((response.result as Record<string, unknown>).protocolVersion).toBe('2024-11-05');
      expect((response.result as Record<string, unknown>).serverInfo).toEqual({
        name: 'tripit-mcp',
        version: '1.0.0',
      });
      expect((response.result as Record<string, unknown>).capabilities).toHaveProperty('tools');
    });
  });

  describe('tools/list', () => {
    it('should return all available tools', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(response.id).toBe(2);
      const result = response.result as { tools: Array<{ name: string }> };
      expect(result.tools).toBeInstanceOf(Array);
      expect(result.tools.length).toBeGreaterThan(0);

      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('tripit_list_trips');
      expect(toolNames).toContain('tripit_get_flight_status');
    });
  });

  describe('tools/call', () => {
    it('should call tripit_list_trips', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'tripit_list_trips',
          arguments: { include_past: true },
        },
      });

      expect(response.id).toBe(3);
      expect(response.error).toBeUndefined();
      expect(client.listTrips).toHaveBeenCalledWith({ past: true });
    });

    it('should call tripit_get_trip with trip_id', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'tripit_get_trip',
          arguments: { trip_id: '123' },
        },
      });

      expect(response.id).toBe(4);
      expect(response.error).toBeUndefined();
      expect(client.getTrip).toHaveBeenCalledWith('123', true);
    });

    it('should call tripit_create_trip', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'tripit_create_trip',
          arguments: {
            display_name: 'Test Trip',
            start_date: '2025-01-15',
            end_date: '2025-01-20',
            primary_location: 'Tokyo',
          },
        },
      });

      expect(response.id).toBe(5);
      expect(response.error).toBeUndefined();
      expect(client.createTrip).toHaveBeenCalledWith({
        display_name: 'Test Trip',
        start_date: '2025-01-15',
        end_date: '2025-01-20',
        primary_location: 'Tokyo',
        description: undefined,
      });
    });

    it('should return error for unknown tool', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      });

      expect(response.id).toBe(6);
      const result = response.result as { content: Array<{ text: string }>; isError: boolean };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should return error when tool name is missing', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {},
      });

      expect(response.id).toBe(7);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('unknown methods', () => {
    it('should return method not found error', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 8,
        method: 'unknown/method',
      });

      expect(response.id).toBe(8);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Method not found');
    });
  });

  describe('ping', () => {
    it('should respond to ping', async () => {
      const client = createMockClient();
      const response = await handleMCPRequest(client, {
        jsonrpc: '2.0',
        id: 9,
        method: 'ping',
      });

      expect(response.id).toBe(9);
      expect(response.result).toEqual({});
      expect(response.error).toBeUndefined();
    });
  });
});
