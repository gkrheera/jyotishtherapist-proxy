/**
 * JyotishTherapist Standalone API Proxy v4.0.0 (POST-based)
 *
 * This version uses a robust POST-based architecture. The frontend sends
 * the target endpoint and parameters in a JSON body, which completely
 * avoids all URL encoding and redirect issues.
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
    // This function now only accepts POST requests.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { CLIENT_ID, CLIENT_SECRET } = process.env;
        const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
        
        // Parse the JSON body sent from the frontend.
        const body = JSON.parse(event.body);
        const { endpoint, params } = body;

        if (!endpoint || !params) {
            throw new Error('Request body must contain "endpoint" and "params".');
        }

        // Construct the query string from the params object.
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
        
        // The frontend now sends the correctly pre-encoded datetime string.
        const targetUrl = `https://api.prokerala.com${endpoint}?${queryString}`;

        const apiResponse = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await apiResponse.text();

        // ProKerala API can return 200 OK with an error message, so we check the body.
        if (apiResponse.ok) {
            const jsonData = JSON.parse(data);
            if (jsonData.status === 'error') {
                 return {
                    statusCode: 400, // Or another appropriate error code
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: jsonData.errors[0].detail }),
                };
            }
        }
        
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

