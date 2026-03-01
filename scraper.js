// Detailed logging of captured JSON response bodies and their structure

const logResponseDetail = (response) => {
    console.log('Response Body:', JSON.stringify(response, null, 2));
    console.log('Response Structure Keys:', Object.keys(response).slice(0, 5)); // Log first few keys
};

// Existing logging code
// ... (previous lines)

// Call logResponseDetail with the JSON response body after line 256.
logResponseDetail(capturedResponse); // Replace capturedResponse with the actual variable used to capture the response body