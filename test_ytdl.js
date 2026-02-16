const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const url = 'https://youtu.be/7D0JGR1ywfg';

(async () => {
    try {
        console.log("Fetching Info...");
        const info = await ytdl.getInfo(url);
        console.log("Title:", info.videoDetails.title);
        console.log("Length:", info.videoDetails.lengthSeconds);

        // formats
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        console.log("Audio Formats Found:", audioFormats.length);

        if (audioFormats.length > 0) {
            console.log("First format:", audioFormats[0].mimeType, audioFormats[0].qualityLabel);

            // Try downloading a chunk
            console.log("Testing download...");
            const stream = ytdl(url, { filter: 'audioonly', quality: 'lowestaudio' }); // lowest for test speed

            const dest = fs.createWriteStream(path.join(__dirname, 'test_ytdl_audio.mp3'));

            stream.pipe(dest);

            await new Promise((resolve, reject) => {
                stream.on('end', () => {
                    console.log("Download complete.");
                    resolve();
                });
                stream.on('error', (err) => {
                    console.error("Download Error:", err);
                    reject(err);
                });
                // Kill after 5s just to verify it starts
                setTimeout(() => {
                    stream.destroy();
                    console.log("Download stream data received (timeout kill).");
                    resolve(); // assume success if no error by now
                }, 5000);
            });

            const stats = fs.statSync(path.join(__dirname, 'test_ytdl_audio.mp3'));
            console.log(`Downloaded ${stats.size} bytes.`);
        } else {
            console.log("No audio formats found.");
        }

    } catch (e) {
        console.error("YTDL Error:", e.message);
    }
})();
