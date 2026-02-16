const ytdl = require('@distube/ytdl-core');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = 'https://youtu.be/7D0JGR1ywfg';

(async () => {
    let browser = null;
    try {
        console.log("Launching Puppeteer to get cookies...");
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        await page.setUserAgent(ua);

        await page.goto(url, { waitUntil: 'networkidle2' });

        // Get Cookies
        const cookies = await page.cookies();
        console.log("Cookies retrieved:", cookies.length);

        // Prepare cookies string or array for ytdl
        // ytdl-core takes an agent with cookies? 
        // Actually distube/ytdl-core supports 'agent' option or 'requestOptions' with headers.

        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Close browser now or keep it open? Close it.
        await browser.close();
        browser = null;

        console.log("Fetching Info with Cookies...");

        const agent = ytdl.createAgent(cookies); // distube/ytdl-core might support this helper or just pass via options

        const info = await ytdl.getInfo(url, {
            agent: agent,
            requestOptions: {
                headers: {
                    'User-Agent': ua,
                    'Cookie': cookieStr,
                    'x-youtube-client-name': '1',
                    'x-youtube-client-version': '2.20240217.09.00' // approximate web client version
                }
            }
        });

        console.log("Title:", info.videoDetails.title);

        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        console.log("Audio Formats Found:", audioFormats.length);

        if (audioFormats.length > 0) {
            console.log("Attempting download...");
            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'lowestaudio',
                agent: agent
            });

            const dest = fs.createWriteStream(path.join(__dirname, 'test_ytdl_auth.mp3'));
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
                setTimeout(() => {
                    stream.destroy();
                    console.log("Download stream OK (timeout kill).");
                    resolve();
                }, 5000);
            });

            const stats = fs.statSync(path.join(__dirname, 'test_ytdl_auth.mp3'));
            console.log(`Downloaded ${stats.size} bytes.`);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (browser) await browser.close();
    }
})();
