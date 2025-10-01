const express = require('express');
// const axios = require('axios'); // For real API calls (currently using simulation)

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Cache en memoria para idempotencia (event_id -> timestamp)
const eventCache = new Map();

// Limpiar cache cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const tenMinutesAgo = now - (10 * 60 * 1000);
  
  for (const [eventId, timestamp] of eventCache.entries()) {
    if (timestamp < tenMinutesAgo) {
      eventCache.delete(eventId);
    }
  }
}, 5 * 60 * 1000);

function validatePayload(payload) {
  const errors = [];
  
  if (!payload.event_id || typeof payload.event_id !== 'string') {
    errors.push('event_id must be a string');
  }
  
  if (!payload.user_id || typeof payload.user_id !== 'string') {
    errors.push('user_id must be a string');
  }
  
  if (!payload.event_name || !['purchase', 'lead'].includes(payload.event_name)) {
    errors.push('event_name must be "purchase" or "lead"');
  }
  
  if (!payload.event_time || typeof payload.event_time !== 'string') {
    errors.push('event_time must be an ISO-8601 string');
  }
  
  if (typeof payload.value !== 'number') {
    errors.push('value must be a number');
  }
  
  if (!payload.campaign_id || typeof payload.campaign_id !== 'string') {
    errors.push('campaign_id must be a string');
  }
  
  // Validar formato de fecha ISO-8601
  if (payload.event_time) {
    const date = new Date(payload.event_time);
    if (isNaN(date.getTime())) {
      errors.push('event_time must be a valid ISO-8601 date string');
    }
  }
  
  return errors;
}

function transformPayload(payload) {
  // Convertir event_time a epoch seconds
  const eventTimeEpoch = Math.floor(new Date(payload.event_time).getTime() / 1000);
  
  // Convertir value a cents (multiplicar por 100)
  const valueCents = Math.round(payload.value * 100);
  
  const transformedPayload = {
    id: payload.event_id,
    user: payload.user_id,
    name: payload.event_name,
    ts: eventTimeEpoch,
    value_cents: valueCents,
    campaign: payload.campaign_id,
    source: 'internal_martech'
  };
  
  return transformedPayload;
}

// Función para simular respuestas del API AdEventsX
function simulateAdEventsXResponse() {
  const random = Math.random();
  
  if (random < 0.6) {
    // 60% success (202 Accepted)
    return {
      status: 202,
      body: { 
        status: "accepted", 
        received_at: new Date().toISOString() 
      }
    };
  } else if (random < 0.7) {
    // 10% invalid payload (400 - no retry)
    return {
      status: 400,
      body: { error: "invalid_payload" }
    };
  } else if (random < 0.75) {
    // 5% unauthorized (401 - no retry)
    return {
      status: 401,
      body: { error: "unauthorized" }
    };
  } else if (random < 0.8) {
    // 5% forbidden (403 - no retry)
    return {
      status: 403,
      body: { error: "unauthorized" }
    };
  } else if (random < 0.9) {
    // 10% rate limited (429 - retry allowed)
    return {
      status: 429,
      body: { error: "rate_limited", retry_after: 2 }
    };
  } else {
    // 10% server error (5xx - retry allowed)
    return {
      status: 500,
      body: { error: "upstream_error" }
    };
  }
}
// Función principal con retry logic
async function forwardToAdEventsX(transformedPayload, requestId) {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    
    try {
      console.log(`[${requestId}] Attempt ${attempt}: Calling AdEventsX API (simulated)`);
      console.log(`[${requestId}] Payload:`, transformedPayload);
      
      // === SIMULATION (ACTIVE) ===
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));
      const simulation = simulateAdEventsXResponse();
      const { status, body } = simulation;
      
      /* === REAL API (COMMENTED) ===
      const response = await axios.post(
        'https://api.adeventsx.example/v1/conversions',
        transformedPayload,
        {
          headers: {
            'X-Api-Key': process.env.ADEVENTSX_API_KEY || 'dummy-key',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      const { status, data: body } = response;
      */
      
      const latency = Date.now() - startTime;
      console.log(`[${requestId}] Response - Status: ${status}, Attempts: ${attempt}, Latency: ${latency}ms`);
      
      // Handle response
      if (status === 202) {
        console.log(`[${requestId}] SUCCESS: Event forwarded successfully`);
        return {
          success: true,
          status,
          attempts: attempt,
          latency,
          response: body
        };
      }
      
      if ([400, 401, 403].includes(status)) {
        console.log(`[${requestId}] Non-retryable error: ${status} - ${body.error}`);
        return {
          success: false,
          status,
          attempts: attempt,
          latency,
          error: body.error
        };
      }
      
      if (status === 429 || status >= 500) {
        console.log(`[${requestId}] Retryable error: ${status} - ${body.error}`);
        
        if (attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt - 1) * baseDelay;
          console.log(`[${requestId}] Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        } else {
          console.log(`[${requestId}] Max retries exceeded`);
          return {
            success: false,
            status,
            attempts: attempt,
            latency,
            error: body.error
          };
        }
      }
      
      // Unexpected status
      console.log(`[${requestId}] Unexpected status: ${status}`);
      return {
        success: false,
        status,
        attempts: attempt,
        latency,
        error: 'Unexpected response status'
      };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.log(`[${requestId}] Network error:`, error.message);
      
      if (attempt === maxRetries) {
        return {
          success: false,
          status: 'NETWORK_ERROR',
          attempts: attempt,
          latency,
          error: error.message
        };
      }
      
      const backoffDelay = Math.pow(2, attempt - 1) * baseDelay;
      console.log(`[${requestId}] Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

// Endpoint POST /events
app.post('/events', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] Received event request`);
  
  try {
    const validationErrors = validatePayload(req.body);
    if (validationErrors.length > 0) {
      console.log(`[${requestId}] Validation failed: ${validationErrors.join(', ')}`);
      return res.status(400).json({
        error: 'invalid_payload',
        details: validationErrors
      });
    }
    
    // Verificar idempotencia
    const eventId = req.body.event_id;
    const now = Date.now();
    
    if (eventCache.has(eventId)) {
      const cachedTime = eventCache.get(eventId);
      const timeDiff = now - cachedTime;
      
      if (timeDiff < (10 * 60 * 1000)) { // 10 minutos
        console.log(`[${requestId}] Duplicate event_id ${eventId}, ignoring (${Math.round(timeDiff/1000)}s ago)`);
        return res.status(200).json({
          status: 'duplicate',
          message: 'Event already processed within 10 minutes'
        });
      }
    }
    
    // Guardar en cache
    eventCache.set(eventId, now);
    
    // Transformar payload
    const transformedPayload = transformPayload(req.body);
    
    // Enviar al API externo
    const result = await forwardToAdEventsX(transformedPayload, requestId);
    
    const totalLatency = Date.now() - startTime;
    
    if (result.success) {
      console.log(`[${requestId}] Request completed successfully in ${totalLatency}ms`);
      return res.status(202).json({
        status: 'accepted',
        request_id: requestId,
        external_status: result.status,
        attempts: result.attempts,
        latency: totalLatency
      });
    } else {
      console.log(`[${requestId}] Request failed in ${totalLatency}ms`);
      return res.status(502).json({
        status: 'failed',
        request_id: requestId,
        external_status: result.status,
        attempts: result.attempts,
        latency: totalLatency,
        error: 'upstream_error'
      });
    }
    
  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error(`[${requestId}] Internal error: ${error.message}, Latency: ${totalLatency}ms`);
    
    return res.status(500).json({
      status: 'error',
      request_id: requestId,
      latency: totalLatency,
      error: 'internal_server_error'
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Events endpoint: POST http://localhost:${PORT}/events`);
});

module.exports = app;
