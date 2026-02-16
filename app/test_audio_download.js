const { Innertube, UniversalCache } = require('youtubei.js');
const fs = require('fs');
const path = require('path');

const videoId = '7D0JGR1ywfg';

(async () => {
    try {
        console.log("Initializing Innertube...");
        const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });

        console.log("Getting Info...");
        const info = await yt.getInfo(videoId);
        console.log("Title:", info.basic_info.title);

        console.log("Downloading Audio...");
        const stream = await yt.download(videoId, {
            type: 'audio', // download audio only
            quality: 'best',
            format: 'mp4' // or webm
        });

        const filePath = path.join(__dirname, 'test_audio.m4a');
        const file = fs.createWriteStream(filePath);

        for await (const chunk of stream) {
            file.write(chunk);
        }
        file.end();

        console.log(`Audio downloaded to ${filePath}`);

        // Check size
        const stats = fs.statSync(filePath);
        console.log(`File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e) {
        console.error("Error:", e);
    }
})();
