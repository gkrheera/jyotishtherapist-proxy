// This Node.js example contains the robust function to fix the error.

// The target API URL from ProKerala (replace with your actual endpoint)
const PROKERALA_API_ENDPOINT = 'https://api.prokerala.com/v2/astrology/panchang.php';
// It's best practice to use environment variables for sensitive data like API keys.
const CLIENT_ID = process.env.PROKERALA_CLIENT_ID || 'YOUR_REAL_CLIENT_ID';

/**
 * A robust function to fetch and parse JSON data from the ProKerala API.
 * @param {string} queryParams - The URL-encoded query parameters for the API call.
 * @returns {Promise<object>} - A promise that resolves to the JSON data or an error object.
 */
async function fetchDataFromProkerala(queryParams) {
    const url = `${PROKERALA_API_ENDPOINT}?client_id=${CLIENT_ID}&${queryParams}`;
    console.log(`[Robust] Fetching URL: ${url}`);

    try {
        const response = await fetch(url);

        // Step 1: Check the HTTP status code.
        if (!response.ok) {
            // Step 2: If status is not ok, read the body as text to see the real error.
            const errorText = await response.text();
            console.error(`[Robust] API returned an error. Status: ${response.status}`);
            // By logging errorText, you see the actual HTML/error message from the server.
            console.error('[Robust] Raw Error Response:', errorText);
            // Throw a new error to be caught by the catch block below.
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        // Step 3: Check the Content-Type header to ensure it's JSON.
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error(`[Robust] Expected JSON, but received: ${contentType}`);
            console.error('[Robust] Raw Non-JSON Response:', responseText);
            throw new Error(`Invalid content type. Expected JSON but got ${contentType}`);
        }
        
        // Step 4: If all checks pass, confidently parse the JSON.
        const data = await response.json();
        console.log('[Robust] Success:', data);
        return data;

    } catch (error) {
        // This will catch both network errors and the errors we threw above.
        console.error('[Robust] A critical error occurred:', error.message);
        return { error: 'An internal server error occurred.', details: error.message };
    }
}


// --- How to use the fixed function ---
async function main() {
    // Example query for panchang - replace with your actual parameters
    const queryParams = new URLSearchParams({
        ayanamsa: '1',
        datetime: '2025-09-12T12:44:00+05:30', // Updated to current time
        la: '12.9716', // Latitude for Bengaluru
        lo: '77.5946'  // Longitude for Bengaluru
    }).toString();

    console.log("--- Running the Robust Fetch Function ---");
    const result = await fetchDataFromProkerala(queryParams);
    
    if (result.error) {
        console.log("\nRequest failed. See error details above.");
    } else {
        console.log("\nRequest was successful!");
    }
}

// Run the main function
main();
