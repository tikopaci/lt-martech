import React, { useState, useEffect } from 'react';
import './App.css';

// Función para generar UUID simple
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Función para obtener parámetros de la URL
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || 'unknown',
    utm_campaign: params.get('utm_campaign') || 'unknown', 
    utm_medium: params.get('utm_medium') || 'unknown',
    utm_content: params.get('utm_content') || 'unknown',
    click_id: params.get('click_id') || 'unknown'
  };
}

function App() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [utmParams, setUtmParams] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Capturar UTMs automáticamente al cargar
  useEffect(() => {
    const params = getUrlParams();
    setUtmParams(params);
    console.log('UTM parameters captured:', params);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !consent) {
      setMessage('Email y consentimiento son obligatorios');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // Datos para localStorage
      const localStorageData = {
        email,
        consent,
        utms: utmParams,
        timestamp: new Date().toISOString()
      };

      // Guardar en localStorage
      localStorage.setItem('leadData', JSON.stringify(localStorageData));
      console.log('Data saved to localStorage:', localStorageData);

      // Datos para el backend
      const eventData = {
        event_id: generateUUID(),
        user_id: email,
        event_name: 'lead',
        event_time: new Date().toISOString(),
        value: 0,
        campaign_id: utmParams.utm_campaign || 'unknown',
        source: utmParams.utm_source || 'unknown',
        click_id: utmParams.click_id || 'unknown'
      };

      // Enviar al backend
      const response = await fetch('http://localhost:3000/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`¡Lead enviado exitosamente! Request ID: ${result.request_id}`);
        setEmail('');
        setConsent(false);
        console.log('Event sent successfully:', result);
      } else {
        const error = await response.json();
        setMessage(`Error al enviar lead: ${error.error || 'Error desconocido'}`);
        console.error('Failed to send event:', error);
      }

    } catch (error) {
      setMessage(`Error de conexión: ${error.message}`);
      console.error('Network error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Mini Landing Page</h1>
        <p>Ejercicio 3 - Formulario de Lead</p>
        
        {/* Mostrar UTMs capturados */}
        <div className="utm-info">
          <h3>UTM Parameters Capturados:</h3>
          <pre>{JSON.stringify(utmParams, null, 2)}</pre>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="lead-form">
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span>Acepto el consentimiento para procesar mis datos (requerido)</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="submit-btn"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Lead'}
          </button>

          {message && (
            <div className={`message ${message.includes('exitosamente') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </form>

        {/* Info de localStorage */}
        <div className="storage-info">
          <h3>Datos guardados en localStorage:</h3>
          <pre>{localStorage.getItem('leadData') || 'Ninguno'}</pre>
        </div>
      </header>
    </div>
  );
}

export default App;