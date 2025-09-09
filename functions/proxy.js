/**
 * JyotishTherapist Standalone API Proxy v2.0.0 (Definitive Fix)
 *
 * This version works with a redirect rule that passes the original request
 * path as a query parameter named 'path'. This makes the proxy robust against
 * path information being lost by the redirect engine.
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
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
            body: '',
        };
    }

    try {
        const { CLIENT_ID, CLIENT_SECRET } = process.env;
        const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
        
        // The new redirect rule provides the original path in the 'path' query parameter.
        const { path, ...queryParams } = event.queryStringParameters;

        if (!path) {
            throw new Error("Target API path is missing. Check the redirect rule in netlify.toml is correct.");
        }

        // Reconstruct the query string for ProKerala from the remaining parameters.
        const prokeralaQueryString = Object.entries(queryParams)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
        
        // The query string from Netlify will have decoded '%2B' to a '+'. We must re-encode it.
        const correctedQueryString = prokeralaQueryString.replace(/\+/g, '%2B');

        // The 'path' from the splat does not include a leading '/', so we add it.
        const targetUrl = `https://api.prokerala.com/${path}?${correctedQueryString}`;

        const apiResponse = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await apiResponse.text();

        return {
            statusCode: apiResponse.status,
            headers: {
                'Access-Control-Allow-Origin': '*',
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

