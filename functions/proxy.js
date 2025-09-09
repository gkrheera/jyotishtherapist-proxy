/**
 * JyotishTherapist Standalone API Proxy v4.1.0 (CORS Fix)
 *
 * This version adds explicit handling for preflight OPTIONS requests,
 * which is required by browsers for cross-origin POST requests. This
 * resolves the final CORS error.
 */

let cachedToken = {
    accessToken: null,
    expiresAt: 0,
};

async function fetchToken(clientId, clientSecret) {
    if (cachedToken.accessToken && cachedToken.expiresAt > Date.now() + 300 * 1000) {
        return cachedToken.accessToken;
    }
    if (!clientId || !clientSecret) {
        throw new Error('API credentials are not configured.');
    }
    const res = await fetch('https://api.prokerala.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });
    if (!res.ok) {
        throw new Error('Failed to fetch token from ProKerala API.');
    }
    const data = await res.json();
    cachedToken.accessToken = data.access_token;
    cachedToken.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken.accessToken;
}

exports.handler = async function(event) {
    // DEFINITIVE FIX: Handle preflight CORS requests from the browser.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // 204 No Content
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow any origin
                'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow these methods
                'Access-Control-Allow-Headers': 'Content-Type', // Allow this header
            },
            body: '',
        };
    }

    // This function now only accepts POST requests for data fetching.
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: 'Method Not Allowed',
            headers: { 'Access-Control-Allow-Origin': '*' } 
        };
    }

    try {
        const { CLIENT_ID, CLIENT_SECRET } = process.env;
        const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
        
        const body = JSON.parse(event.body);
        const { endpoint, params } = body;

        if (!endpoint || !params) {
            throw new Error('Request body must contain "endpoint" and "params".');
        }

        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
        
        const targetUrl = `https://api.prokerala.com${endpoint}?${queryString}`;

        const apiResponse = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await apiResponse.text();
        
        const responseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': apiResponse.headers.get('Content-Type') || 'application/json',
        };

        if (apiResponse.ok) {
            const jsonData = JSON.parse(data);
            if (jsonData.status === 'error' && jsonData.errors) {
                 return {
                    statusCode: 400,
                    headers: responseHeaders,
                    body: JSON.stringify({ error: jsonData.errors[0].detail }),
                };
            }
        }
        
        return {
            statusCode: apiResponse.status,
            headers: responseHeaders,
            body: data,
        };

    } catch (e) {
        console.error("Proxy Function Error:", e.message);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: e.message }),
        };
    }
};

