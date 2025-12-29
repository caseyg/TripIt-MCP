"""TripIt API client with OAuth 1.0a authentication."""

import asyncio
import json
import time
import urllib.parse
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from oauthlib.oauth1 import Client as OAuth1Client


class TripItError(Exception):
    """Base exception for TripIt API errors."""

    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.message = message
        self.code = code


class TripItAuthError(TripItError):
    """Authentication error - token expired or revoked."""

    pass


class TripItAPIError(TripItError):
    """General API error from TripIt."""

    pass


class TripItNotFoundError(TripItError):
    """Requested resource not found."""

    pass


class TripItProRequiredError(TripItError):
    """Feature requires TripIt Pro subscription."""

    pass


@dataclass
class TripItCredentials:
    """OAuth 1.0a credentials for TripIt."""

    consumer_key: str
    consumer_secret: str
    access_token: str
    access_token_secret: str


ObjectType = Literal[
    "air",
    "activity",
    "car",
    "parking",
    "cruise",
    "directions",
    "lodging",
    "map",
    "note",
    "points_program",
    "profile",
    "rail",
    "restaurant",
    "transport",
    "trip",
    "weather",
]


class TripItClient:
    """Async TripIt API client with OAuth 1.0a authentication.

    Uses HMAC-SHA1 signatures as required by TripIt's OAuth implementation.
    Implements rate limiting (2-5 req/sec) and exponential backoff for errors.
    """

    BASE_URL = "https://api.tripit.com/v1"
    MAX_RETRIES = 3
    BASE_DELAY = 1.0  # Base delay for exponential backoff
    REQUEST_DELAY = 0.3  # Minimum delay between requests (~3 req/sec)

    def __init__(self, credentials: TripItCredentials):
        self.credentials = credentials
        self._oauth_client = OAuth1Client(
            client_key=credentials.consumer_key,
            client_secret=credentials.consumer_secret,
            resource_owner_key=credentials.access_token,
            resource_owner_secret=credentials.access_token_secret,
            signature_method="HMAC-SHA1",
        )
        self._http_client: httpx.AsyncClient | None = None
        self._last_request_time: float = 0

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None

    def _sign_request(
        self, method: str, url: str, body: str | None = None
    ) -> dict[str, str]:
        """Generate OAuth 1.0a signed headers for a request."""
        # oauthlib needs the full URL and optional body for signature
        headers: dict[str, str] = {}
        if body:
            headers["Content-Type"] = "application/x-www-form-urlencoded"

        # Sign the request - oauthlib handles nonce, timestamp, signature
        uri, signed_headers, _ = self._oauth_client.sign(
            url,
            http_method=method,
            body=body,
            headers=headers,
        )

        return dict(signed_headers)

    async def _rate_limit(self) -> None:
        """Enforce rate limiting between requests."""
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < self.REQUEST_DELAY:
            await asyncio.sleep(self.REQUEST_DELAY - elapsed)
        self._last_request_time = time.monotonic()

    async def _request(
        self,
        method: str,
        endpoint: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Make an authenticated request to the TripIt API.

        Args:
            method: HTTP method (GET or POST)
            endpoint: API endpoint (e.g., "/list/trip")
            body: Optional request body for POST requests

        Returns:
            Parsed JSON response

        Raises:
            TripItAuthError: Authentication failed
            TripItNotFoundError: Resource not found
            TripItAPIError: Other API errors
        """
        url = f"{self.BASE_URL}{endpoint}"

        # Format body for TripIt's expected format: format=json&json=<url-encoded-json>
        encoded_body: str | None = None
        if body:
            json_str = json.dumps(body)
            encoded_body = f"format=json&json={urllib.parse.quote(json_str)}"

        # Add format=json to GET requests
        if method == "GET" and "?" not in url:
            url = f"{url}?format=json"
        elif method == "GET":
            url = f"{url}&format=json"

        client = await self._get_client()
        last_error: Exception | None = None

        for attempt in range(self.MAX_RETRIES):
            await self._rate_limit()

            try:
                headers = self._sign_request(method, url, encoded_body)

                if method == "GET":
                    response = await client.get(url, headers=headers)
                else:
                    response = await client.post(
                        url, headers=headers, content=encoded_body
                    )

                # Handle response status codes
                if response.status_code == 401:
                    raise TripItAuthError(
                        "Authentication failed - token may be expired or revoked",
                        code=401,
                    )
                elif response.status_code == 404:
                    raise TripItNotFoundError("Resource not found", code=404)
                elif response.status_code == 429:
                    # Rate limited - back off and retry
                    delay = self.BASE_DELAY * (2**attempt)
                    await asyncio.sleep(delay)
                    continue
                elif response.status_code >= 500:
                    # Server error - back off and retry
                    delay = self.BASE_DELAY * (2**attempt)
                    await asyncio.sleep(delay)
                    last_error = TripItAPIError(
                        f"Server error: {response.status_code}", code=response.status_code
                    )
                    continue
                elif response.status_code >= 400:
                    raise TripItAPIError(
                        f"API error: {response.text}", code=response.status_code
                    )

                return response.json()

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                delay = self.BASE_DELAY * (2**attempt)
                await asyncio.sleep(delay)
                last_error = TripItAPIError(f"Network error: {e}")
                continue

        # All retries exhausted
        if last_error:
            raise last_error
        raise TripItAPIError("Request failed after retries")

    # =========================================================================
    # Trip Operations
    # =========================================================================

    async def list_trips(
        self,
        past: bool = False,
        modified_since: str | None = None,
        include_objects: bool = False,
        traveler: str | None = None,
        page_num: int = 1,
        page_size: int = 25,
    ) -> dict[str, Any]:
        """List trips with optional filters.

        Args:
            past: Include past (completed) trips
            modified_since: ISO timestamp for incremental sync
            include_objects: Include nested travel objects in response
            traveler: Filter by traveler (true/false/all)
            page_num: Page number for pagination
            page_size: Number of results per page

        Returns:
            Dict with Trip array and pagination metadata
        """
        endpoint = "/list/trip"
        params: list[str] = []

        if past:
            params.append("past=true")
        if modified_since:
            params.append(f"modified_since={urllib.parse.quote(modified_since)}")
        if include_objects:
            params.append("include_objects=true")
        if traveler:
            params.append(f"traveler={traveler}")
        params.append(f"page_num={page_num}")
        params.append(f"page_size={page_size}")

        if params:
            endpoint = f"{endpoint}?{'&'.join(params)}"

        return await self._request("GET", endpoint)

    async def get_trip(
        self, trip_id: str, include_objects: bool = True
    ) -> dict[str, Any]:
        """Get a trip by ID.

        Args:
            trip_id: TripIt trip ID
            include_objects: Include nested travel objects

        Returns:
            Trip object with optional nested objects
        """
        endpoint = f"/get/trip/id/{trip_id}"
        if include_objects:
            endpoint = f"{endpoint}?include_objects=true"
        return await self._request("GET", endpoint)

    async def create_trip(self, trip_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new trip.

        Args:
            trip_data: Trip data including:
                - display_name: Trip name
                - start_date: Start date (YYYY-MM-DD)
                - end_date: End date (YYYY-MM-DD)
                - primary_location: Primary destination

        Returns:
            Created trip with TripIt-assigned ID
        """
        return await self._request("POST", "/create", {"Trip": trip_data})

    async def update_trip(
        self, trip_id: str, trip_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Replace a trip (full replacement, not partial update).

        Args:
            trip_id: TripIt trip ID
            trip_data: Complete trip data

        Returns:
            Updated trip object
        """
        return await self._request(
            "POST", f"/replace/trip/id/{trip_id}", {"Trip": trip_data}
        )

    async def delete_trip(self, trip_id: str) -> dict[str, Any]:
        """Delete a trip.

        Args:
            trip_id: TripIt trip ID

        Returns:
            Confirmation response
        """
        return await self._request("GET", f"/delete/trip/id/{trip_id}")

    # =========================================================================
    # Travel Object Operations
    # =========================================================================

    async def list_objects(
        self,
        object_type: ObjectType,
        trip_id: str | None = None,
        past: bool = False,
        page_num: int = 1,
        page_size: int = 25,
    ) -> dict[str, Any]:
        """List travel objects by type.

        Args:
            object_type: Type of object (air, lodging, car, etc.)
            trip_id: Optional trip ID to filter by
            past: Include objects from past trips
            page_num: Page number for pagination
            page_size: Number of results per page

        Returns:
            Dict with object array and pagination metadata
        """
        endpoint = f"/list/{object_type}"
        params: list[str] = []

        if trip_id:
            params.append(f"trip_id={trip_id}")
        if past:
            params.append("past=true")
        params.append(f"page_num={page_num}")
        params.append(f"page_size={page_size}")

        if params:
            endpoint = f"{endpoint}?{'&'.join(params)}"

        return await self._request("GET", endpoint)

    async def get_object(
        self, object_type: ObjectType, object_id: str
    ) -> dict[str, Any]:
        """Get a travel object by type and ID.

        Args:
            object_type: Type of object (air, lodging, car, etc.)
            object_id: TripIt object ID

        Returns:
            Travel object data
        """
        return await self._request("GET", f"/get/{object_type}/id/{object_id}")

    async def create_object(
        self,
        object_type: ObjectType,
        object_data: dict[str, Any],
        trip_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a travel object.

        Args:
            object_type: Type of object to create
            object_data: Object data following TripIt schema
            trip_id: Optional trip ID to assign object to

        Returns:
            Created object with TripIt-assigned ID
        """
        # Map object_type to TripIt's expected key names
        type_to_key = {
            "air": "AirObject",
            "lodging": "LodgingObject",
            "car": "CarObject",
            "rail": "RailObject",
            "restaurant": "RestaurantObject",
            "activity": "ActivityObject",
            "note": "NoteObject",
            "directions": "DirectionsObject",
            "cruise": "CruiseObject",
            "transport": "TransportObject",
            "map": "MapObject",
            "parking": "ParkingObject",
        }

        key = type_to_key.get(object_type)
        if not key:
            raise TripItAPIError(f"Cannot create objects of type: {object_type}")

        data = {key: object_data}
        if trip_id:
            data[key]["trip_id"] = trip_id

        return await self._request("POST", "/create", data)

    async def update_object(
        self,
        object_type: ObjectType,
        object_id: str,
        object_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Replace a travel object (full replacement, not partial).

        Args:
            object_type: Type of object
            object_id: TripIt object ID
            object_data: Complete object data

        Returns:
            Updated object
        """
        type_to_key = {
            "air": "AirObject",
            "lodging": "LodgingObject",
            "car": "CarObject",
            "rail": "RailObject",
            "restaurant": "RestaurantObject",
            "activity": "ActivityObject",
            "note": "NoteObject",
            "directions": "DirectionsObject",
            "cruise": "CruiseObject",
            "transport": "TransportObject",
            "map": "MapObject",
            "parking": "ParkingObject",
        }

        key = type_to_key.get(object_type)
        if not key:
            raise TripItAPIError(f"Cannot update objects of type: {object_type}")

        return await self._request(
            "POST", f"/replace/{object_type}/id/{object_id}", {key: object_data}
        )

    async def delete_object(
        self, object_type: ObjectType, object_id: str
    ) -> dict[str, Any]:
        """Delete a travel object.

        Args:
            object_type: Type of object
            object_id: TripIt object ID

        Returns:
            Confirmation response
        """
        return await self._request("GET", f"/delete/{object_type}/id/{object_id}")

    # =========================================================================
    # Pro Features
    # =========================================================================

    async def get_flight_status(self, air_id: str) -> dict[str, Any]:
        """Get real-time flight status (TripIt Pro feature).

        Returns flight status including delays, gates, and baggage claim.
        Status codes: 100=Not Monitorable, 200=Not Monitored, 300=Scheduled,
        301=On Time, 302=Delayed, etc.

        Args:
            air_id: TripIt air object ID

        Returns:
            Air object with Status data in Segment

        Raises:
            TripItProRequiredError: If flight status is not available (not Pro)
        """
        result = await self.get_object("air", air_id)

        # Check if status data is present (indicates Pro subscription)
        air_object = result.get("AirObject", result)
        segments = air_object.get("Segment", [])
        if isinstance(segments, dict):
            segments = [segments]

        if segments and "Status" not in segments[0]:
            raise TripItProRequiredError(
                "Flight status requires TripIt Pro subscription"
            )

        return result

    async def list_points_programs(self) -> dict[str, Any]:
        """List loyalty/points programs (TripIt Pro feature).

        Returns:
            Dict with PointsProgram array
        """
        return await self._request("GET", "/list/points_program")

    async def get_alternate_flights(self, air_id: str) -> str | None:
        """Get URL for alternate flight options (TripIt Pro feature).

        Args:
            air_id: TripIt air object ID

        Returns:
            URL for rebooking options, or None if not available
        """
        result = await self.get_object("air", air_id)
        air_object = result.get("AirObject", result)
        return air_object.get("alternate_flights_url")

    # =========================================================================
    # Profile and Utility
    # =========================================================================

    async def get_profile(self) -> dict[str, Any]:
        """Get the authenticated user's profile.

        Returns:
            Profile data including name, email, settings
        """
        return await self._request("GET", "/get/profile")

    async def search_trips(
        self,
        query: str,
        past: bool = False,
        page_num: int = 1,
        page_size: int = 25,
    ) -> dict[str, Any]:
        """Search trips by text query.

        Args:
            query: Search text
            past: Include past trips in search
            page_num: Page number for pagination
            page_size: Number of results per page

        Returns:
            Dict with matching Trip array
        """
        endpoint = f"/list/trip?search_text={urllib.parse.quote(query)}"
        if past:
            endpoint = f"{endpoint}&past=true"
        endpoint = f"{endpoint}&page_num={page_num}&page_size={page_size}"

        return await self._request("GET", endpoint)
