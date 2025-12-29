/**
 * MCP tools for TripIt trip management.
 */

import { z } from 'zod';
import type { TripItClient } from '../../tripit/client.js';
import { handleTripItError } from '../../lib/errors.js';

export const tripTools = {
  tripit_list_trips: {
    description: 'List all trips. Returns upcoming trips by default.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_past: {
          type: 'boolean',
          description: 'Include completed trips',
        },
        modified_since: {
          type: 'string',
          description: 'ISO timestamp for incremental sync',
        },
        include_objects: {
          type: 'boolean',
          description: 'Include nested travel objects',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination',
        },
        page_size: {
          type: 'number',
          description: 'Results per page (default: 5)',
        },
      },
    },
  },

  tripit_get_trip: {
    description: 'Get detailed information about a specific trip including all travel objects.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: {
          type: 'string',
          description: 'TripIt trip ID',
        },
        include_objects: {
          type: 'boolean',
          description: 'Include flights, hotels, cars, etc.',
          default: true,
        },
      },
      required: ['trip_id'],
    },
  },

  tripit_create_trip: {
    description: 'Create a new trip container. Travel objects can be added afterward.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        display_name: {
          type: 'string',
          description: 'Trip name (e.g., "Tokyo Business Trip")',
        },
        start_date: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        primary_location: {
          type: 'string',
          description: 'Main destination city',
        },
        description: {
          type: 'string',
          description: 'Trip notes or description',
        },
      },
      required: ['display_name', 'start_date', 'end_date'],
    },
  },

  tripit_update_trip: {
    description: 'Update trip details. This replaces the entire trip object.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: {
          type: 'string',
          description: 'TripIt trip ID',
        },
        display_name: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        primary_location: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['trip_id'],
    },
  },

  tripit_delete_trip: {
    description: 'Permanently delete a trip and all its travel objects.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: {
          type: 'string',
          description: 'TripIt trip ID to delete',
        },
      },
      required: ['trip_id'],
    },
  },
};

export async function handleTripTool(
  client: TripItClient,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'tripit_list_trips': {
        const result = await client.listTrips({
          past: args.include_past as boolean | undefined,
          modifiedSince: args.modified_since
            ? Math.floor(Date.parse(args.modified_since as string) / 1000)
            : undefined,
          includeObjects: args.include_objects as boolean | undefined,
          page: args.page as number | undefined,
          pageSize: args.page_size as number | undefined,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_get_trip': {
        const result = await client.getTrip(
          args.trip_id as string,
          args.include_objects !== false
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_create_trip': {
        const result = await client.createTrip({
          display_name: args.display_name as string,
          start_date: args.start_date as string,
          end_date: args.end_date as string,
          primary_location: args.primary_location as string | undefined,
          description: args.description as string | undefined,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_update_trip': {
        const { trip_id, ...updates } = args;
        const result = await client.updateTrip(trip_id as string, updates);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_delete_trip': {
        await client.deleteTrip(args.trip_id as string);
        return {
          content: [{ type: 'text', text: `Trip ${args.trip_id} deleted successfully.` }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return handleTripItError(error);
  }
}
