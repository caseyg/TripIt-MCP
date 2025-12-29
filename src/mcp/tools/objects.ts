/**
 * MCP tools for TripIt travel object management.
 */

import type { TripItClient } from '../../tripit/client.js';
import { handleTripItError } from '../../lib/errors.js';
import type { ObjectType, CreatableObjectType } from '../../tripit/types.js';

const OBJECT_TYPES = [
  'air', 'lodging', 'car', 'rail', 'cruise', 'restaurant',
  'activity', 'note', 'transport', 'parking', 'directions', 'map',
] as const;

export const objectTools = {
  tripit_list_objects: {
    description: 'List travel objects (flights, hotels, cars, etc.) optionally filtered by trip.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        object_type: {
          type: 'string',
          enum: OBJECT_TYPES,
          description: 'Type of travel object',
        },
        trip_id: {
          type: 'string',
          description: 'Filter to specific trip',
        },
      },
      required: ['object_type'],
    },
  },

  tripit_get_object: {
    description: 'Get detailed information about a specific travel object.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        object_type: {
          type: 'string',
          enum: OBJECT_TYPES,
          description: 'Type of travel object',
        },
        object_id: {
          type: 'string',
          description: 'Object ID',
        },
      },
      required: ['object_type', 'object_id'],
    },
  },

  tripit_create_flight: {
    description: 'Add a flight to TripIt. Will auto-assign to matching trip or Unfiled.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: {
          type: 'string',
          description: 'Assign to specific trip (optional)',
        },
        segments: {
          type: 'array',
          description: 'Flight segments (connections = multiple segments)',
          items: {
            type: 'object',
            properties: {
              start_date: { type: 'string', description: 'Departure date (YYYY-MM-DD)' },
              start_time: { type: 'string', description: 'Departure time (HH:MM:SS)' },
              end_date: { type: 'string', description: 'Arrival date (YYYY-MM-DD)' },
              end_time: { type: 'string', description: 'Arrival time (HH:MM:SS)' },
              start_airport_code: { type: 'string', description: 'Origin airport (e.g., SFO)' },
              end_airport_code: { type: 'string', description: 'Destination airport (e.g., NRT)' },
              marketing_airline_code: { type: 'string', description: 'Airline code (e.g., UA)' },
              marketing_flight_number: { type: 'string', description: 'Flight number' },
              operating_airline_code: { type: 'string' },
              operating_flight_number: { type: 'string' },
              aircraft: { type: 'string' },
              seats: { type: 'string' },
              confirmation_num: { type: 'string' },
            },
            required: [
              'start_date', 'start_time', 'end_date', 'end_time',
              'start_airport_code', 'end_airport_code',
              'marketing_airline_code', 'marketing_flight_number',
            ],
          },
        },
      },
      required: ['segments'],
    },
  },

  tripit_create_hotel: {
    description: 'Add a hotel reservation to TripIt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: { type: 'string' },
        supplier_name: { type: 'string', description: 'Hotel name' },
        start_date: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
        check_in_time: { type: 'string', description: 'Check-in time (HH:MM:SS)' },
        check_out_time: { type: 'string', description: 'Check-out time (HH:MM:SS)' },
        confirmation_num: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['city', 'country'],
        },
        phone: { type: 'string' },
        room_type: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['supplier_name', 'start_date', 'end_date', 'address'],
    },
  },

  tripit_create_car: {
    description: 'Add a car rental reservation to TripIt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: { type: 'string' },
        supplier_name: { type: 'string', description: 'Rental company (e.g., Hertz)' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        pickup_location: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['city', 'country'],
        },
        dropoff_location: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
          },
        },
        car_type: { type: 'string' },
        confirmation_num: { type: 'string' },
      },
      required: ['supplier_name', 'start_date', 'end_date', 'pickup_location'],
    },
  },

  tripit_create_activity: {
    description: 'Add a generic activity (tour, event, meeting) to TripIt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        trip_id: { type: 'string' },
        display_name: { type: 'string', description: 'Activity name' },
        start_date: { type: 'string' },
        start_time: { type: 'string' },
        end_date: { type: 'string' },
        end_time: { type: 'string' },
        location_name: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
          },
        },
        notes: { type: 'string' },
      },
      required: ['display_name', 'start_date'],
    },
  },

  tripit_update_object: {
    description: 'Update a travel object. This replaces the entire object.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        object_type: {
          type: 'string',
          enum: ['air', 'lodging', 'car', 'rail', 'cruise', 'restaurant', 'activity', 'note'],
        },
        object_id: { type: 'string' },
        data: {
          type: 'object',
          description: 'Updated object data',
        },
      },
      required: ['object_type', 'object_id', 'data'],
    },
  },

  tripit_delete_object: {
    description: 'Delete a travel object from TripIt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        object_type: {
          type: 'string',
          enum: OBJECT_TYPES,
        },
        object_id: { type: 'string' },
      },
      required: ['object_type', 'object_id'],
    },
  },
};

export async function handleObjectTool(
  client: TripItClient,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'tripit_list_objects': {
        const result = await client.listObjects(
          args.object_type as ObjectType,
          args.trip_id as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_get_object': {
        const result = await client.getObject(
          args.object_type as ObjectType,
          args.object_id as string
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_create_flight': {
        const result = await client.createFlight(
          args.segments as Array<{
            start_date: string;
            start_time: string;
            end_date: string;
            end_time: string;
            start_airport_code: string;
            end_airport_code: string;
            marketing_airline_code: string;
            marketing_flight_number: string;
          }>,
          args.trip_id as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_create_hotel': {
        const result = await client.createHotel(
          {
            supplier_name: args.supplier_name as string,
            start_date: args.start_date as string,
            end_date: args.end_date as string,
            check_in_time: args.check_in_time as string | undefined,
            check_out_time: args.check_out_time as string | undefined,
            confirmation_num: args.confirmation_num as string | undefined,
            address: args.address as { city: string; country: string; address?: string; state?: string },
            phone: args.phone as string | undefined,
            room_type: args.room_type as string | undefined,
            notes: args.notes as string | undefined,
          },
          args.trip_id as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_create_car': {
        const result = await client.createCar(
          {
            supplier_name: args.supplier_name as string,
            start_date: args.start_date as string,
            end_date: args.end_date as string,
            start_time: args.start_time as string | undefined,
            end_time: args.end_time as string | undefined,
            pickup_location: args.pickup_location as { city: string; country: string },
            dropoff_location: args.dropoff_location as { city: string; country: string } | undefined,
            car_type: args.car_type as string | undefined,
            confirmation_num: args.confirmation_num as string | undefined,
          },
          args.trip_id as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_create_activity': {
        const result = await client.createActivity(
          {
            display_name: args.display_name as string,
            start_date: args.start_date as string,
            start_time: args.start_time as string | undefined,
            end_date: args.end_date as string | undefined,
            end_time: args.end_time as string | undefined,
            location_name: args.location_name as string | undefined,
            address: args.address as { city: string; country: string } | undefined,
            notes: args.notes as string | undefined,
          },
          args.trip_id as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_update_object': {
        const result = await client.updateObject(
          args.object_type as CreatableObjectType,
          args.object_id as string,
          args.data as Record<string, unknown>
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_delete_object': {
        await client.deleteObject(
          args.object_type as ObjectType,
          args.object_id as string
        );
        return {
          content: [{ type: 'text', text: `${args.object_type} ${args.object_id} deleted successfully.` }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return handleTripItError(error);
  }
}
