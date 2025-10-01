# Frontend Mini Landing Page - Exercise 3

A minimal React landing page that captures lead information and forwards it to the backend API.

## Features

**Form Components:**
- Email input field with validation
- Required consent checkbox

**Automatic UTM Capture:**
- Captures UTM parameters from URL query string on page load
- Supported parameters: utm_source, utm_campaign, utm_medium, utm_content, click_id
- Displays captured parameters in real-time
- Uses 'unknown' as default value for missing parameters

**Data Handling:**
- Saves form data to localStorage with timestamp
- Sends POST request to backend API (/events endpoint)
- Generates unique UUID for each event
- Provides visual feedback for success/error states

## Prerequisites

Backend API must be running on http://localhost:3000

## Installation and Setup

```bash
cd frontend
npm install
npm start
```

The application will start on http://localhost:3000.

## Testing the Application

### Basic Test
1. Open http://localhost:3000
2. Fill in email address
3. Check consent checkbox
4. Click "Enviar Lead"
5. Verify success message appears

### UTM Parameters Test
Visit the application with UTM parameters in the URL:

```
http://localhost:3000?utm_source=google&utm_campaign=test_campaign&utm_medium=cpc&utm_content=ad1&click_id=click123
```

Expected behavior:
- UTM parameters should appear in the "UTM Parameters Capturados" section
- Form submission should include these parameters in the backend request


## Data Flow

**On Page Load:**
- Extracts UTM parameters from URL using URLSearchParams
- Displays captured parameters

**On Form Submit:**
- Validates email and consent
- Saves to localStorage: `{email, consent, utms, timestamp}`
- Sends POST to backend with payload:
  ```json
  {
    "event_id": "<generated UUID>",
    "user_id": "<email>",
    "event_name": "lead",
    "event_time": "<ISO timestamp>",
    "value": 0,
    "campaign_id": "<utm_campaign or 'unknown'>",
    "source": "<utm_source or 'unknown'>",
    "click_id": "<click_id or 'unknown'>"
  }
  ```
