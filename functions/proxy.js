/**
 * CORRECTED PROXY FUNCTION (functions/proxy.js)
 * This function is now fully compatible with the Prokerala API specification.
 *
 * It correctly implements the OAuth2 client credentials flow to get an access token
 * and then uses that token in the Authorization header for API requests.
 * It also handles token caching to improve performance.
 */

// Use URLSearchParams for easier query string management
const { URLSearchParams } = require('url');

const TOKEN_ENDPOINT = 'https://api.prokerala.com/token';
const API_BASE_URL = 'https://api.prokerala.com/v2';

// In-memory cache for the access token. In a real-world, scalable application,
// you might use a more persistent cache like Redis or a database.
let tokenCache = {
    accessToken: null,
    expiresAt: null,
};

/**
 * Fetches a new OAuth2 access token from the Prokerala token endpoint.
 * This should only be called when we don't have a valid cached token.
 */
async function getNewAccessToken() {
    const clientId = process.env.PROKERALA_CLIENT_ID;
    const clientSecret = process.env.PROKERALA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("Client ID or Client Secret is not configured in environment variables.");
        return null;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Token request failed with status ${response.status}:`, errorText);
            return null;
        }

        const data = await response.json();
        const now = new Date();
        // Set expiry time a little earlier (e.g., 5 minutes) to be safe
        const expiresAt = new Date(now.getTime() + (data.expires_in - 300) * 1000);

        console.log("Successfully fetched new access token.");
        return {
            accessToken: data.access_token,
            expiresAt: expiresAt,
        };
    } catch (error) {
        console.error("Error fetching access token:", error);
        return null;
    }
}

/**
 * Main handler function for the serverless proxy.
 */
exports.handler = async (event) => {
    // Check if the cached token is still valid
    if (!tokenCache.accessToken || new Date() >= tokenCache.expiresAt) {
        console.log("Token is expired or not available. Fetching a new one.");
        tokenCache = await getNewAccessToken();
    }

    if (!tokenCache || !tokenCache.accessToken) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Could not retrieve API access token." }),
        };
    }

    // The frontend should specify which API endpoint it wants to call.
    // e.g., /astrology/panchang
    const requestedEndpoint = event.queryStringParameters.endpoint;
    if (!requestedEndpoint) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "API endpoint parameter is missing." }),
        };
    }

    // Create a new URLSearchParams object, removing our custom 'endpoint' param
    const originalParams = new URLSearchParams(event.queryStringParameters);
    originalParams.delete('endpoint');

    const finalApiUrl = `${API_BASE_URL}${requestedEndpoint}?${originalParams.toString()}`;

    console.log(`[Proxy] Making authenticated request to: ${finalApiUrl}`);

    try {
        const apiResponse = await fetch(finalApiUrl, {
            headers: {
                // Correctly use the Bearer token in the Authorization header
                Authorization: `Bearer ${tokenCache.accessToken}`,
            },
        });

        const contentType = apiResponse.headers.get('content-type');

        // Gracefully handle non-JSON error pages from the API
        if (!apiResponse.ok || !contentType || !contentType.includes('application/json')) {
            const errorBody = await apiResponse.text();
            console.error(`[Proxy] API returned a non-OK or non-JSON response. Status: ${apiResponse.status}`);
            console.error("[Proxy] Raw Error Body:", errorBody);
            return {
                statusCode: apiResponse.status,
                body: JSON.stringify({
                    error: "Received an invalid response from the ProKerala API.",
                    details: errorBody.substring(0, 500) + '...' // Truncate long HTML errors
                }),
            };
        }

        const data = await apiResponse.json();

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('[Proxy] Critical error during API fetch:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred in the proxy.' }),
        };
    }
};
