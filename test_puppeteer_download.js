const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const videoUrl = 'https://youtu.be/7D0JGR1ywfg';

(async () => {
    console.log("Launching Puppeteer to intercept audio (HEADFUL)...");
    const browser = await puppeteer.launch({
        // headless: "new",
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let audioUrl = null;
    let headers = null;

    await page.setRequestInterception(true);

    page.on('request', request => {
        if (request.resourceType() === 'image' || request.resourceType() === 'font') {
            request.abort();
        } else {
            request.continue();
        }
    });

    page.on('response', response => {
        const url = response.url();
        if (url.includes('googlevideo.com') && url.includes('mime=audio')) {
            if (!audioUrl) {
                console.log("Found Audio URL!");
                audioUrl = url;
                headers = response.request().headers();
            }
        }
    });

    try {
        console.log("Navigating...");
        await page.goto(videoUrl, { waitUntil: 'networkidle2' });

        // Wait a bit to ensure playback/buffering starts
        // We might need to click play?
        // Youtube usually auto-plays or buffers.

        await new Promise(r => setTimeout(r, 5000));

        if (audioUrl) {
            console.log("Audio URL captured.");
            // console.log("URL:", audioUrl);

            // Try downloading a chunk to verify
            const dest = path.join(__dirname, 'test_audio_dump.mp4');
            const file = fs.createWriteStream(dest);

            console.log("Attempting download via https...");

            // Prepare headers for the request
            // Note: Puppeteer headers might be slightly different than what node https expects structure-wise
            const reqHeaders = {
                'User-Agent': headers['user-agent'],
                'Cookie': headers['cookie'],
                'Referer': 'https://www.youtube.com/',
                'Range': 'bytes=0-1000000' // Get first 1MB
            };

            await new Promise((resolve, reject) => {
                https.get(audioUrl, { headers: reqHeaders }, (res) => {
                    console.log("Response Status:", res.statusCode);
                    if (res.statusCode === 200 || res.statusCode === 206) {
                        res.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            console.log("Download finished (partial).");
                            resolve();
                        });
                    } else {
                        console.log("Download failed with status:", res.statusCode);
                        reject(new Error("Status " + res.statusCode));
                    }
                }).on('error', (err) => {
                    fs.unlink(dest, () => { });
                    console.error("Download error:", err.message);
                    reject(err);
                });
            });

            const stats = fs.statSync(dest);
            console.log(`Downloaded ${stats.size} bytes.`);

        } else {
            console.log("No audio URL found. Attempting to click play...");
            await page.evaluate(() => {
                const playBtn = document.querySelector('.ytp-play-button');
                if (playBtn) playBtn.click();
            });
            await new Promise(r => setTimeout(r, 5000));
            if (!audioUrl) console.log("Still no audio URL.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
})();
