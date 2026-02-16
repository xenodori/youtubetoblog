const { YoutubeTranscript } = require('youtube-transcript');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // Known video with captions
const apiKey = process.env.GEMINI_API_KEY;

console.log("Testing with URL:", url);
console.log("API Key Present:", !!apiKey);

const { Innertube, UniversalCache } = require('youtubei.js');

async function run() {
    try {
        console.log("1. Fetching Transcript... SKIPPED (Testing Gemini first)");
        /*
        const yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
        const info = await yt.getInfo(url.split('v=')[1]);
        const transcriptData = await info.getTranscript();
        */

        let transcript = "This is a dummy transcript about technology and AI. It talks about how AI is changing the world.";

        console.log("Transcript fetched. Length:", transcript.length);

        console.log("2. Testing Gemini...");
        const genAI = new GoogleGenerativeAI(apiKey);
        // Trying gemini-flash-latest (without 1.5)
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = "Explain this transcript briefly: " + transcript.substring(0, 500);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Gemini Response:", response.text());

    } catch (error) {
        console.error("ERROR OCCURRED:");
        console.error(error);
    }
}

run();
