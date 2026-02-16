const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("Qeurying:", url.replace(apiKey, "HIDDEN"));

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        try {
            const json = JSON.parse(data);
            if (json.models) {
                console.log("Available Models:");
                json.models.forEach(m => console.log(m.name));
            } else {
                console.log("No models found or error:", json);
            }
        } catch (e) {
            console.log("Error parsing JSON:", e);
            console.log("Raw:", data);
        }
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
