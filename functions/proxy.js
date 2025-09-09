/**
 * JyotishTherapist Standalone API Proxy v1.0.0
 *
 * This serverless function acts as a dedicated, secure proxy to the ProKerala API.
 * It handles token management, securely adds API credentials, forwards requests,
 * and manages CORS headers.
 */

// A simple in-memory cache for the access token to improve performance.
let cachedToken = {
    accessToken: null,
    expiresAt: 0,
};

/**
 * Gets a valid OAuth 2.0 access token, using a cache to avoid unnecessary requests.
 * @param {string} clientId Your ProKerala Client ID.
 * @param {string} clientSecret Your ProKerala Client Secret.
 * @returns {Promise<string>} The access token.
 */
async function fetchToken(clientId, clientSecret) {
    // Return cached token if it's still valid for at least 5 more minutes.
    if (cachedToken.accessToken && cachedToken.expiresAt > Date.now() + 300 * 1000) {
        return cachedToken.accessToken;
    }
    if (!clientId || !clientSecret) {
        throw new Error('API credentials are not configured in the environment.');
    }

    const res = await fetch('https://api.prokerala.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });

    if (!res.ok) {
        throw new Error('Failed to fetch token from ProKerala API. Check credentials.');
    }
    const data = await res.json();
    cachedToken.accessToken = data.access_token;
    // Set expiry time to be slightly less than the actual expiry for a safety buffer.
    cachedToken.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken.accessToken;
}

exports.handler = async function(event) {
    // Handle preflight CORS requests sent by browsers.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*', // Or specify your frontend domain for better security
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
            body: '',
        };
    }

    try {
        const { CLIENT_ID, CLIENT_SECRET } = process.env;
        const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
        
        // Extract the target API path and query string from the incoming request.
        const prokeralaPath = event.path.replace('/.netlify/functions/proxy', '');
        const queryString = event.rawQuery;
        
        const targetUrl = `https://api.prokerala.com${prokeralaPath}?${queryString}`;

        const apiResponse = await fetch(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        // Pass the response from the ProKerala API directly back to the client.
        const data = await apiResponse.text();

        return {
            statusCode: apiResponse.status,
            headers: {
                'Access-Control-Allow-Origin': '*', // Or specify your frontend domain
                'Content-Type': apiResponse.headers.get('Content-Type') || 'application/json',
            },
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

