/**
 * TripIt API type definitions.
 */

export type ObjectType =
  | 'trip'
  | 'air'
  | 'lodging'
  | 'car'
  | 'rail'
  | 'cruise'
  | 'restaurant'
  | 'activity'
  | 'note'
  | 'directions'
  | 'transport'
  | 'parking'
  | 'map'
  | 'points_program'
  | 'profile'
  | 'weather';

export type CreatableObjectType =
  | 'air'
  | 'lodging'
  | 'car'
  | 'rail'
  | 'cruise'
  | 'restaurant'
  | 'activity'
  | 'note'
  | 'directions'
  | 'transport'
  | 'parking'
  | 'map';

export interface Address {
  address?: string;
  city: string;
  state?: string;
  country: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
}

export interface DateTime {
  date: string;
  time?: string;
  timezone?: string;
  utc_offset?: string;
}

export interface FlightSegment {
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
  start_terminal?: string;
  end_terminal?: string;
  Status?: FlightStatus;
  StartDateTime?: DateTime;
  EndDateTime?: DateTime;
}

export interface FlightStatus {
  flight_status?: string;
  EstimatedDepartureDateTime?: DateTime;
  EstimatedArrivalDateTime?: DateTime;
  departure_gate?: string;
  arrival_gate?: string;
  baggage_claim?: string;
  delay_in_minutes?: number;
}

export interface AirObject {
  id: string;
  trip_id: string;
  Segment: FlightSegment | FlightSegment[];
  relative_url?: string;
}

export interface LodgingObject {
  id: string;
  trip_id: string;
  supplier_name: string;
  start_date: string;
  end_date: string;
  Address?: Address;
  supplier_conf_num?: string;
  supplier_phone?: string;
  room_type?: string;
  notes?: string;
}

export interface CarObject {
  id: string;
  trip_id: string;
  supplier_name: string;
  start_date: string;
  end_date: string;
  start_location_name?: string;
  end_location_name?: string;
  StartLocationAddress?: Address;
  EndLocationAddress?: Address;
  car_type?: string;
  supplier_conf_num?: string;
}

export interface ActivityObject {
  id: string;
  trip_id: string;
  display_name: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location_name?: string;
  Address?: Address;
  notes?: string;
}

export interface Trip {
  id: string;
  display_name: string;
  start_date: string;
  end_date: string;
  primary_location?: string;
  PrimaryLocationAddress?: Address;
  description?: string;
  relative_url?: string;
  AirObject?: AirObject | AirObject[];
  LodgingObject?: LodgingObject | LodgingObject[];
  CarObject?: CarObject | CarObject[];
  ActivityObject?: ActivityObject | ActivityObject[];
}

export interface TripListResponse {
  Trip?: Trip | Trip[];
  page_num?: number;
  page_size?: number;
  max_page?: number;
}

export interface TripResponse {
  Trip?: Trip;
}

export interface ProfileResponse {
  Profile?: {
    screen_name?: string;
    public_display_name?: string;
    email_addresses?: string[];
    home_city?: string;
    is_pro?: boolean;
  };
}

export interface PointsProgramResponse {
  PointsProgram?: Array<{
    id: string;
    name: string;
    account_number?: string;
    balance?: string;
    last_modified?: string;
  }>;
}

export interface CreateTripData {
  display_name: string;
  start_date: string;
  end_date: string;
  primary_location?: string;
  description?: string;
}
