const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // **DEFINITIVE FIX**: This logic correctly gets the endpoint from the query string.
    // The frontend sends `?endpoint=v2/location/geo-details&...`
    const { endpoint, ...params } = event.queryStringParameters;

    const CLIENT_ID = process.env.PROKERALA_CLIENT_ID;
    const CLIENT_SECRET = process.env.PROKERALA_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API credentials are not configured on the server." }),
        };
    }

    // This check now works correctly because 'endpoint' is sent directly by the frontend.
    if (!endpoint) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "API endpoint is required." }),
        };
    }

    const API_HOST = "https://api.prokerala.com";
    const auth = "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64");

    const queryString = new URLSearchParams(params).toString();
    // The endpoint is a full path like 'v2/location/geo-details'
    const url = `${API_HOST}/${endpoint}?${queryString}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': auth,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        return {
            statusCode: response.status,
            headers: {
                // Required for the browser to allow the request from your frontend site.
                "Access-Control-Allow-Origin": "*", 
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Error in proxy function:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "An internal server error occurred.", details: error.message }),
        };
    }
};

