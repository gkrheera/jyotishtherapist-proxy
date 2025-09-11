const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const { endpoint, ...params } = event.queryStringParameters;

    // IMPORTANT: Store your API credentials securely as environment variables
    const CLIENT_ID = process.env.PROKERALA_CLIENT_ID;
    const CLIENT_SECRET = process.env.PROKERALA_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API credentials are not configured on the server." }),
        };
    }

    if (!endpoint) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "API endpoint is required." }),
        };
    }

    const API_HOST = "https://api.prokerala.com/v2/astrology";
    const auth = "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64");

    const queryString = new URLSearchParams(params).toString();
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
        
        // Forward the status code from the target API
        return {
            statusCode: response.status,
            headers: {
                "Access-Control-Allow-Origin": "*", // Allow requests from any origin
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
