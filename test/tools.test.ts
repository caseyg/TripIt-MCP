/**
 * Tests for MCP tool definitions and routing.
 */

import { describe, it, expect } from 'vitest';
import { getToolDefinitions, allTools } from '../src/mcp/tools/index.js';

describe('Tool Definitions', () => {
  it('should have all 16 expected tools', () => {
    const tools = getToolDefinitions();
    expect(tools.length).toBe(16);
  });

  it('should include all trip management tools', () => {
    const toolNames = Object.keys(allTools);
    expect(toolNames).toContain('tripit_list_trips');
    expect(toolNames).toContain('tripit_get_trip');
    expect(toolNames).toContain('tripit_create_trip');
    expect(toolNames).toContain('tripit_update_trip');
    expect(toolNames).toContain('tripit_delete_trip');
  });

  it('should include all object management tools', () => {
    const toolNames = Object.keys(allTools);
    expect(toolNames).toContain('tripit_list_objects');
    expect(toolNames).toContain('tripit_get_object');
    expect(toolNames).toContain('tripit_create_flight');
    expect(toolNames).toContain('tripit_create_hotel');
    expect(toolNames).toContain('tripit_create_car');
    expect(toolNames).toContain('tripit_create_activity');
    expect(toolNames).toContain('tripit_update_object');
    expect(toolNames).toContain('tripit_delete_object');
  });

  it('should include all pro feature tools', () => {
    const toolNames = Object.keys(allTools);
    expect(toolNames).toContain('tripit_get_flight_status');
    expect(toolNames).toContain('tripit_list_points_programs');
    expect(toolNames).toContain('tripit_get_profile');
  });

  it('should have valid input schemas for all tools', () => {
    const tools = getToolDefinitions();

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('should have required fields for create tools', () => {
    const tools = getToolDefinitions();

    const createTrip = tools.find(t => t.name === 'tripit_create_trip');
    expect(createTrip?.inputSchema.required).toContain('display_name');
    expect(createTrip?.inputSchema.required).toContain('start_date');
    expect(createTrip?.inputSchema.required).toContain('end_date');

    const createFlight = tools.find(t => t.name === 'tripit_create_flight');
    expect(createFlight?.inputSchema.required).toContain('segments');

    const createHotel = tools.find(t => t.name === 'tripit_create_hotel');
    expect(createHotel?.inputSchema.required).toContain('supplier_name');
    expect(createHotel?.inputSchema.required).toContain('start_date');
    expect(createHotel?.inputSchema.required).toContain('end_date');
    expect(createHotel?.inputSchema.required).toContain('address');
  });

  it('should have proper enum values for object types', () => {
    const tools = getToolDefinitions();

    const listObjects = tools.find(t => t.name === 'tripit_list_objects');
    const objectTypeEnum = listObjects?.inputSchema.properties?.object_type?.enum;

    expect(objectTypeEnum).toContain('air');
    expect(objectTypeEnum).toContain('lodging');
    expect(objectTypeEnum).toContain('car');
    expect(objectTypeEnum).toContain('rail');
    expect(objectTypeEnum).toContain('activity');
  });
});
