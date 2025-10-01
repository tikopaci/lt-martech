# Backend - Events API

Simple Node.js service that handles event data and forwards it to an external API (AdEventsX).

## Features

- **Validation**: Validates incoming JSON payload
- **Transformation**: Converts event_time to epoch seconds and value to cents
- **Idempotency**: Prevents duplicate events within 10 minutes using in-memory cache
- **Retry Logic**: Exponential backoff with max 3 attempts for 429 and 5xx errors
- **Logging**: Request ID, status, attempts, and latency for each request

## Installation

```bash
cd backend
npm install
```

## Running the Server

```bash
npm start
```

The server will start on port 3000 (or the PORT eSSSnvironment variable).

## Endpoints

### POST /events
Receives and processes event data.

**Request Body:**
```json
{
  "event_id": "uuid",
  "user_id": "string", 
  "event_name": "purchase | lead",
  "event_time": "ISO-8601 string",
  "value": 0.0,
  "campaign_id": "string"
}
```

**Response (Success):**
```json
{
  "status": "accepted",
  "request_id": "req_123...",
  "external_status": 202,
  "attempts": 1,
  "latency": 150
}
```

## Testing

You can test the endpoint using curl:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "test-124",
    "user_id": "user-456", 
    "event_name": "purchase",
    "event_time": "2025-09-23T10:00:00.000Z",
    "value": 29.99,
    "campaign_id": "campaign-789"
  }'
```

## AdEventsX API Simulation

The external AdEventsX API is simulated with the following response probabilities:
- **Success (202):** `{ "status": "accepted", "received_at": "<iso>" }`
- **Invalid Payload (400):** `{ "error": "invalid_payload" }` (no retry)
- **Unauthorized (401):** `{ "error": "unauthorized" }` (no retry)
- **Forbidden (403):** `{ "error": "unauthorized" }` (no retry) 
- **Rate Limited (429):** `{ "error": "rate_limited", "retry_after": 2 }` (retry with exponential backoff)
- **Server Error (500):** `{ "error": "upstream_error" }` (retry with exponential backoff)

**Retry Logic:**
- Maximum 3 attempts
- Exponential backoff: 1s, 2s, 4s delays
- Only retries on 429 and 5xx status codes
- No retry on 4xx errors (except 429)

## Environment Variables

- `PORT`: Server port (default: 3000)

## Cache Management

The in-memory cache automatically cleans up entries older than 10 minutes every 5 minutes to prevent memory leaks.
