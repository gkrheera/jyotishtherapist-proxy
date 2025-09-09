/**
 * JyotishTherapist Standalone API Proxy v5.0.0 (Reverted & Fixed)
 *
 * This version reverts to the stable POST-based architecture and applies
 * the definitive fix for the API's data format error. It manually
 * constructs the query string to ensure the datetime parameter with its
 * literal '+' is sent exactly as the ProKerala API expects.
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

        // DEFINITIVE FIX: Manually build the query string to handle the API's
        // specific requirement for a literal '+' in the datetime.
        const queryString = Object.entries(params)
            .map(([key, value]) => {
                // Pass datetime as-is, but encode other params like coordinates.
                if (key === 'datetime') {
                    return `${key}=${value}`;
                }
                return `${key}=${encodeURIComponent(value)}`;
            })
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

