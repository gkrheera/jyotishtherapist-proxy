/**
 * Secure Serverless Proxy for Prokerala API (functions/proxy.js)
 *
 * This function acts as a secure intermediary between your frontend application
 * and the Prokerala API. It is designed to be deployed as a Netlify serverless function.
 *
 * Core Responsibilities:
 * 1.  **Securely Handles Credentials**: It uses environment variables (PROKERALA_CLIENT_ID
 * and PROKERALA_CLIENT_SECRET) to authenticate, keeping them hidden from the browser.
 * 2.  **Manages OAuth2 Authentication**: It correctly performs the client_credentials grant
 * flow to obtain a temporary access token from the /token endpoint.
 * 3.  **Caches Access Tokens**: It stores the access token in memory and reuses it until it
 * is about to expire, preventing unnecessary token requests on every API call.
 * 4.  **Proxies API Requests**: It forwards requests from the frontend to the appropriate
 * Prokerala API endpoint, adding the required 'Authorization: Bearer <token>' header.
 * 5.  **Handles Errors Gracefully**: It provides clear error messages if token retrieval or
 * the final API call fails.
 */
const { URLSearchParams } = require('url');

const TOKEN_ENDPOINT = 'https://api.prokerala.com/token';
const API_BASE_URL = 'https://api.prokerala.com/v2';

// In-memory cache for the access token. This improves performance by reusing tokens.
let tokenCache = {
    accessToken: null,
    expiresAt: null,
};

// Fetches a new OAuth2 access token.
async function getNewAccessToken() {
    const clientId = process.env.PROKERALA_CLIENT_ID;
    const clientSecret = process.env.PROKERALA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("ERROR: PROKERALA_CLIENT_ID and PROKERALA_CLIENT_SECRET must be set as environment variables.");
        return null;
    }

    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });

    try {
        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Token request failed with status ${response.status}:`, errorText);
            return null;
        }

        const data = await response.json();
        // Set expiry 5 minutes early to be safe.
        const expiresAt = new Date(new Date().getTime() + (data.expires_in - 300) * 1000);

        console.log("Successfully fetched a new access token.");
        return { accessToken: data.access_token, expiresAt };
    } catch (error) {
        console.error("Error fetching access token:", error);
        return null;
    }
}

// Main serverless function handler.
exports.handler = async (event) => {
    // Check if the cached token is invalid or expired.
    if (!tokenCache.accessToken || new Date() >= tokenCache.expiresAt) {
        console.log("Token is expired or not available. Fetching a new one.");
        tokenCache = await getNewAccessToken();
    }

    if (!tokenCache || !tokenCache.accessToken) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Could not retrieve API access token. Please check serverless function logs and ensure environment variables are set." }),
        };
    }

    // Determine the target API endpoint from the request path.
    // e.g., a request to '/api/astrology/panchang' becomes '/astrology/panchang'.
    const requestedEndpoint = event.path.replace(/^\/api/, '');
    const queryString = event.rawQuery;

    const finalApiUrl = `${API_BASE_URL}${requestedEndpoint}${queryString ? '?' + queryString : ''}`;

    console.log(`[Proxy] Forwarding request to: ${finalApiUrl}`);

    try {
        const apiResponse = await fetch(finalApiUrl, {
            headers: {
                // Add the Authorization header as required by the spec.
                'Authorization': `Bearer ${tokenCache.accessToken}`,
            },
        });

        const responseData = await apiResponse.text();

        // Pass through the status and content-type from the target API.
        return {
            statusCode: apiResponse.status,
            headers: {
                'Content-Type': apiResponse.headers.get('Content-Type') || 'application/json',
            },
            body: responseData,
        };

    } catch (error) {
        console.error('[Proxy] Error during API fetch:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred while proxying the request.' }),
        };
    }
};

