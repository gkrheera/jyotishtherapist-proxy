/**
 * JyotishTherapist Standalone API Proxy v8.0.0 (Restored & Verified)
 *
 * This version reverts to the simplest possible proxy logic. It trusts that the
 * frontend is sending a perfectly formatted URL string and passes it directly
 * to the ProKerala API without any modification. This is the most robust way
 * to handle the API's non-standard encoding requirements.
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
    try {
        const { CLIENT_ID, CLIENT_SECRET } = process.env;
        const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
        
        const path = event.path.replace('/.netlify/functions/proxy', '');
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
