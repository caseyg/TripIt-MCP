/**
 * MCP tools for TripIt Pro features.
 */

import type { TripItClient } from '../../tripit/client.js';
import { handleTripItError, ProRequiredError } from '../../lib/errors.js';
import type { FlightSegment } from '../../tripit/types.js';

export const proTools = {
  tripit_get_flight_status: {
    description:
      'Get real-time flight status including delays, gates, and baggage claim. Requires TripIt Pro.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        flight_id: {
          type: 'string',
          description: 'Air object ID from tripit_list_objects',
        },
      },
      required: ['flight_id'],
    },
  },

  tripit_list_points_programs: {
    description: 'List loyalty program memberships and point balances. Requires TripIt Pro.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },

  tripit_get_profile: {
    description: "Get the authenticated user's TripIt profile.",
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
};

export async function handleProTool(
  client: TripItClient,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'tripit_get_flight_status': {
        const result = await client.getFlightStatus(args.flight_id as string);

        // Extract and format flight status info
        const airObject = result.AirObject;
        if (!airObject) {
          return {
            content: [{ type: 'text', text: 'Flight not found' }],
            isError: true,
          };
        }

        let segments = airObject.Segment;
        if (!Array.isArray(segments)) {
          segments = [segments];
        }

        const statusInfo = (segments as FlightSegment[]).map((seg) => ({
          flight: `${seg.marketing_airline_code}${seg.marketing_flight_number}`,
          route: `${seg.start_airport_code} → ${seg.end_airport_code}`,
          status: seg.Status?.flight_status || 'Not monitored',
          scheduled_departure: seg.StartDateTime
            ? `${seg.StartDateTime.date} ${seg.StartDateTime.time}`
            : `${seg.start_date} ${seg.start_time}`,
          estimated_departure: seg.Status?.EstimatedDepartureDateTime?.date
            ? `${seg.Status.EstimatedDepartureDateTime.date} ${seg.Status.EstimatedDepartureDateTime.time}`
            : null,
          departure_gate: seg.Status?.departure_gate ?? null,
          departure_terminal: seg.start_terminal ?? null,
          baggage_claim: seg.Status?.baggage_claim ?? null,
          delay_minutes: seg.Status?.delay_in_minutes ?? null,
        }));

        // Check if Pro features are available
        const hasStatus = statusInfo.some((s) => s.status !== 'Not monitored');
        if (!hasStatus && segments.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    note: 'Real-time flight status requires TripIt Pro. Showing basic flight info.',
                    segments: statusInfo,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return { content: [{ type: 'text', text: JSON.stringify(statusInfo, null, 2) }] };
      }

      case 'tripit_list_points_programs': {
        const result = await client.listPointsPrograms();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'tripit_get_profile': {
        const result = await client.getProfile();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return handleTripItError(error);
  }
}
