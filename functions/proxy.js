/**
 * JyotishTherapist Standalone API Proxy v4.2.0 (Final & Robust)
 *
 * This version implements the definitive fix. The proxy is now solely
 * responsible for all URL encoding, using the standard URLSearchParams
 * object. This is a robust, best-practice solution that correctly
 * handles all special characters.
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
    // Handle preflight CORS requests.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: '',
        };
    }

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

        // DEFINITIVE FIX: Use URLSearchParams to robustly encode all parameters.
        // This correctly handles '+' in datetime, commas in coordinates, etc.
        const searchParams = new URLSearchParams(params);
        const queryString = searchParams.toString();
        
        const targetUrl = `https://api.prokerala.com${endpoint}?${queryString}`;

        const apiResponse = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await apiResponse.text();
        
        const responseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': apiResponse.headers.get('Content-Type') || 'application/json',
        };

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

