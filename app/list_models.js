const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        // Note: older SDKs might not expose listModels directly easily, 
        // but the error message suggested calling it. 
        // For the Node SDK, it's usually via the model manager if exposed, 
        // or we can try a basic fetch to the list endpoint manually if SDK doesn't support it top-level.
        // However, let's try to infer from common knowledge first or use a fallback.
        // Actually, looking at docs, genAI.getGenerativeModel is the main entry.
        // The error comes from the API response.

        // Let's try 'gemini-1.5-flash-latest' or 'gemini-1.0-pro'.
        console.log("Testing model: gemini-1.5-flash-latest");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash-latest");
        console.log(result.response.text());
    } catch (e) {
        console.log("Failed gemini-1.5-flash-latest:", e.message);
    }

    try {
        console.log("Testing model: gemini-pro");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-pro");
        console.log(result.response.text());
    } catch (e) {
        console.log("Failed gemini-pro:", e.message);
    }
}

listModels();
