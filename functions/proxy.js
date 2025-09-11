const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // All parameters from the original request are here
    const params = event.queryStringParameters;
    
    // The captured path from the redirect rule is now in `params.path`
    const path = params.path;

    // IMPORTANT: Store your API credentials securely as environment variables
    const CLIENT_ID = process.env.PROKERALA_CLIENT_ID;
    const CLIENT_SECRET = process.env.PROKERALA_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API credentials are not configured on the server." }),
        };
    }

    // Check if the path was successfully passed
    if (!path || path.trim() === '') {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "API endpoint path is required." }),
        };
    }
    
    // Remove the 'path' parameter itself so it's not sent to the ProKerala API
    delete params.path;

    const API_HOST = "https://api.prokerala.com";
    const auth = "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64");

    const queryString = new URLSearchParams(params).toString();
    // Construct the URL with the path from the redirect
    const url = `${API_HOST}/${path}?${queryString}`;
    
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
