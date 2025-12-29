/**
 * TripIt API client.
 *
 * Handles authenticated requests to TripIt API v1.
 * Uses OAuth 1.0a signatures and implements rate limiting with exponential backoff.
 */

import { TripItOAuth } from './oauth.js';
import { TripItError, AuthenticationError, NotFoundError } from '../lib/errors.js';
import type {
  ObjectType,
  CreatableObjectType,
  TripListResponse,
  TripResponse,
  ProfileResponse,
  PointsProgramResponse,
  CreateTripData,
  AirObject,
} from './types.js';

const BASE_URL = 'https://api.tripit.com/v1';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MIN_REQUEST_INTERVAL_MS = 400; // ~2.5 req/sec

export class TripItClient {
  private lastRequestTime = 0;

  constructor(
    private oauth: TripItOAuth,
    private accessToken: string,
    private accessTokenSecret: string
  ) {}

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    let url = `${BASE_URL}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await this.throttle();

      try {
        // For GET requests, append /format/json to path
        const requestUrl = method === 'GET' ? `${url}/format/json` : url;

        const headers = this.oauth.signRequest(
          method,
          requestUrl,
          this.accessToken,
          this.accessTokenSecret
        );

        const options: RequestInit = {
          method,
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        };

        if (body && method === 'POST') {
          options.body = `format=json&json=${encodeURIComponent(JSON.stringify(body))}`;
        }

        const response = await fetch(requestUrl, options);

        if (response.status === 401) {
          throw new AuthenticationError();
        }

        if (response.status === 404) {
          throw new NotFoundError('resource', path);
        }

        if (response.status === 429 || response.status >= 500) {
          // Rate limited or server error - retry with backoff
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          lastError = new TripItError(response.status, `Server error: ${response.status}`);
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          throw new TripItError(response.status, text);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof AuthenticationError || error instanceof NotFoundError) {
          throw error;
        }
        if (error instanceof TripItError) {
          lastError = error;
        } else {
          lastError = new TripItError(0, String(error));
        }
        // Retry on network errors
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new TripItError(0, 'Request failed after retries');
  }

  // ========================================================================
  // Trip Operations
  // ========================================================================

  async listTrips(options?: {
    past?: boolean;
    modifiedSince?: number;
    includeObjects?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<TripListResponse> {
    let path = '/list/trip';
    if (options?.past) path += '/past/true';
    if (options?.modifiedSince) path += `/modified_since/${options.modifiedSince}`;
    if (options?.includeObjects) path += '/include_objects/true';
    if (options?.page) path += `/page_num/${options.page}`;
    if (options?.pageSize) path += `/page_size/${options.pageSize}`;

    return this.request('GET', path);
  }

  async getTrip(id: string, includeObjects = true): Promise<TripResponse> {
    const path = `/get/trip/id/${id}${includeObjects ? '/include_objects/true' : ''}`;
    return this.request('GET', path);
  }

  async createTrip(data: CreateTripData): Promise<TripResponse> {
    return this.request('POST', '/create', { Trip: data });
  }

  async updateTrip(id: string, data: Partial<CreateTripData>): Promise<TripResponse> {
    return this.request('POST', `/replace/trip/id/${id}`, { Trip: data });
  }

  async deleteTrip(id: string): Promise<void> {
    await this.request('GET', `/delete/trip/id/${id}`);
  }

  // ========================================================================
  // Generic Object Operations
  // ========================================================================

  async getObject<T = Record<string, unknown>>(type: ObjectType, id: string): Promise<T> {
    return this.request('GET', `/get/${type}/id/${id}`);
  }

  async listObjects(type: ObjectType, tripId?: string): Promise<Record<string, unknown>> {
    const path = tripId ? `/list/${type}/trip_id/${tripId}` : `/list/${type}`;
    return this.request('GET', path);
  }

  async createObject(
    type: CreatableObjectType,
    data: Record<string, unknown>,
    tripId?: string
  ): Promise<Record<string, unknown>> {
    const key = this.capitalize(type);
    const payload: Record<string, unknown> = { [key]: data };
    if (tripId) {
      (payload[key] as Record<string, unknown>).trip_id = tripId;
    }
    return this.request('POST', '/create', payload);
  }

  async updateObject(
    type: CreatableObjectType,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const key = this.capitalize(type);
    return this.request('POST', `/replace/${type}/id/${id}`, { [key]: data });
  }

  async deleteObject(type: ObjectType, id: string): Promise<void> {
    await this.request('GET', `/delete/${type}/id/${id}`);
  }

  // ========================================================================
  // Specialized Object Creation
  // ========================================================================

  async createFlight(
    segments: Array<{
      start_date: string;
      start_time: string;
      end_date: string;
      end_time: string;
      start_airport_code: string;
      end_airport_code: string;
      marketing_airline_code: string;
      marketing_flight_number: string;
      operating_airline_code?: string;
      operating_flight_number?: string;
      aircraft?: string;
      seats?: string;
      confirmation_num?: string;
    }>,
    tripId?: string
  ): Promise<Record<string, unknown>> {
    return this.createObject('air', { Segment: segments }, tripId);
  }

  async createHotel(
    data: {
      supplier_name: string;
      start_date: string;
      end_date: string;
      check_in_time?: string;
      check_out_time?: string;
      confirmation_num?: string;
      address: {
        address?: string;
        city: string;
        state?: string;
        country: string;
      };
      phone?: string;
      room_type?: string;
      notes?: string;
    },
    tripId?: string
  ): Promise<Record<string, unknown>> {
    const lodgingData: Record<string, unknown> = {
      supplier_name: data.supplier_name,
      start_date: data.start_date,
      end_date: data.end_date,
      Address: data.address,
    };

    if (data.check_in_time) lodgingData.StartDateTime = { time: data.check_in_time };
    if (data.check_out_time) lodgingData.EndDateTime = { time: data.check_out_time };
    if (data.confirmation_num) lodgingData.supplier_conf_num = data.confirmation_num;
    if (data.phone) lodgingData.supplier_phone = data.phone;
    if (data.room_type) lodgingData.room_type = data.room_type;
    if (data.notes) lodgingData.notes = data.notes;

    return this.createObject('lodging', lodgingData, tripId);
  }

  async createCar(
    data: {
      supplier_name: string;
      start_date: string;
      end_date: string;
      start_time?: string;
      end_time?: string;
      pickup_location: {
        address?: string;
        city: string;
        state?: string;
        country: string;
      };
      dropoff_location?: {
        address?: string;
        city: string;
        state?: string;
        country: string;
      };
      car_type?: string;
      confirmation_num?: string;
    },
    tripId?: string
  ): Promise<Record<string, unknown>> {
    const carData: Record<string, unknown> = {
      supplier_name: data.supplier_name,
      start_date: data.start_date,
      end_date: data.end_date,
      start_location_name: data.pickup_location.city,
      StartLocationAddress: data.pickup_location,
      end_location_name: data.dropoff_location?.city || data.pickup_location.city,
      EndLocationAddress: data.dropoff_location || data.pickup_location,
    };

    if (data.start_time) carData.StartDateTime = { time: data.start_time };
    if (data.end_time) carData.EndDateTime = { time: data.end_time };
    if (data.car_type) carData.car_type = data.car_type;
    if (data.confirmation_num) carData.supplier_conf_num = data.confirmation_num;

    return this.createObject('car', carData, tripId);
  }

  async createActivity(
    data: {
      display_name: string;
      start_date: string;
      start_time?: string;
      end_date?: string;
      end_time?: string;
      location_name?: string;
      address?: {
        address?: string;
        city: string;
        state?: string;
        country: string;
      };
      notes?: string;
    },
    tripId?: string
  ): Promise<Record<string, unknown>> {
    const activityData: Record<string, unknown> = {
      display_name: data.display_name,
      start_date: data.start_date,
    };

    if (data.start_time) activityData.start_time = data.start_time;
    if (data.end_date) activityData.end_date = data.end_date;
    if (data.end_time) activityData.end_time = data.end_time;
    if (data.location_name) activityData.location_name = data.location_name;
    if (data.address) activityData.Address = data.address;
    if (data.notes) activityData.notes = data.notes;

    return this.createObject('activity', activityData, tripId);
  }

  // ========================================================================
  // Pro Features
  // ========================================================================

  async getFlightStatus(airId: string): Promise<{ AirObject?: AirObject }> {
    return this.request('GET', `/get/air/id/${airId}`);
  }

  async listPointsPrograms(): Promise<PointsProgramResponse> {
    return this.request('GET', '/list/points_program');
  }

  async getProfile(): Promise<ProfileResponse> {
    return this.request('GET', '/get/profile');
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private capitalize(s: string): string {
    // Map object type to TripIt's expected key format
    const typeMap: Record<string, string> = {
      air: 'AirObject',
      lodging: 'LodgingObject',
      car: 'CarObject',
      rail: 'RailObject',
      cruise: 'CruiseObject',
      restaurant: 'RestaurantObject',
      activity: 'ActivityObject',
      note: 'NoteObject',
      directions: 'DirectionsObject',
      transport: 'TransportObject',
      parking: 'ParkingObject',
      map: 'MapObject',
    };
    return typeMap[s] || s.charAt(0).toUpperCase() + s.slice(1);
  }
}
