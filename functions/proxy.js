/**
 * JyotishTherapist Standalone API Proxy v3.0.0 (Verified Fix)
 *
 * This version uses the standard Netlify splat (*) rewrite pattern.
 * It reliably gets the target API path by parsing event.path, which
 * is the documented and correct way to handle rewrites.
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
        
        // DEFINITIVE FIX: Extract the target path from the function's invocation path.
        // event.path will be like '/.netlify/functions/proxy/v2/astrology/kundli'
        // We need to extract the part after the function name.
        const pathPrefix = '/.netlify/functions/proxy/';
        const prokeralaPath = event.path.startsWith(pathPrefix) ? event.path.substring(pathPrefix.length) : null;

        if (!prokeralaPath) {
             throw new Error(`Could not determine the target API path from the event path: ${event.path}`);
        }

        const queryString = event.rawQuery;
        
        // The query string from Netlify will have decoded '%2B' to a '+'. We must re-encode it.
        const correctedQueryString = queryString.replace(/\+/g, '%2B');

        const targetUrl = `https://api.prokerala.com/${prokeralaPath}?${correctedQueryString}`;

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

