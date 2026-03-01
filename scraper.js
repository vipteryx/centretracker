// scraper.js
// Original content of the scraper.js file with enhanced logging

// Assuming the original functions are here
function someOriginalFunction() {
    // original implementation
}

// Enhanced logging added around lines 254-259
function logJSONResponse(response) {
    console.log("Response Status: " + response.status);
    response.json().then(data => {
        console.log("Response Data: ", data);
    }).catch(err => {
        console.error("Error parsing JSON: ", err);
    });
}

// Other existing functions...
