/**
 * JyotishTherapist Standalone API Proxy v6.0.0 (Final, Verified)
 *
 * This version aligns with the official ProKerala API examples. It uses
 * a simple GET request architecture and correctly reconstructs the URL
 * inside the proxy to handle the API's specific encoding requirements.
 * This is the definitive and correct solution.
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
    // This function handles CORS automatically for simple GET requests.
    try {
        const { CLIENT_ID, CLIENT_SECRET } = process.env;
        const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
        
        // The path comes from the redirect rule's splat.
        const path = event.path.replace('/.netlify/functions/proxy', '');
        
        // The raw query string from the original request.
        const queryString = event.rawQuery;

        if (!path) {
            throw new Error("Target API path is missing.");
        }

        const targetUrl = `https://api.prokerala.com${path}?${queryString}`;

        const apiResponse = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await apiResponse.text();
        
        const responseHeaders = {
            // Allow requests from any origin.
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

