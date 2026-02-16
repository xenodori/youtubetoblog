const puppeteer = require('puppeteer');
const fs = require('fs');
const url = "https://youtu.be/7D0JGR1ywfg?si=65wOEdS8knF-mcdp";

(async () => {
    console.log("Launching Puppeteer for Network Intercept (HEADFUL)...");
    let browser = null;
    try {
        browser = await puppeteer.launch({
            // headless: "new",
            headless: false, // Try visible browser to bypass bot detection
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Setup Response Listener
        let transcriptData = null;

        page.on('response', async response => {
            const reqUrl = response.url();
            if (reqUrl.includes('get_transcript')) {
                console.log("Intercepted Transcript Request:", reqUrl);
                console.log("Status:", response.status());
                try {
                    const data = await response.json();
                    transcriptData = data;
                    console.log("Transcript Data Captured!");
                } catch (e) {
                    console.error("Failed to parse transcript JSON:", e.message);
                }
            }
        });

        const urlWithLang = url + (url.includes('?') ? '&' : '?') + 'hl=en';
        console.log("Navigating to:", urlWithLang);

        await page.goto(urlWithLang, { waitUntil: 'networkidle2' });

        // 1. Scroll
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(r => setTimeout(r, 2000));

        // 2. Expand Description
        try {
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, tp-yt-paper-button, #expand'));
                const moreBtn = buttons.find(b => {
                    const t = b.innerText.trim();
                    return t.includes("더보기") || t.includes("more");
                });
                if (moreBtn) moreBtn.click();
                else {
                    const expand = document.querySelector('#expand');
                    if (expand) expand.click();
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { }

        // 3. Click "Show transcript"
        console.log("Clicking transcript button...");
        const clicked = await page.evaluate(async () => {
            const buttons = Array.from(document.querySelectorAll('button, ytd-button-renderer'));
            const target = buttons.find(b => {
                const t = b.innerText && b.innerText.toLowerCase();
                return t && (t.includes("show transcript") || t.includes("스크립트"));
            });
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            console.log("Button Clicked. Waiting for network response...");
            // Wait for variable to be populated
            for (let i = 0; i < 10; i++) {
                if (transcriptData) break;
                await new Promise(r => setTimeout(r, 1000));
                console.log(`Waiting... ${i + 1}`);
            }

            if (transcriptData) {
                // Parse it
                // Structure: actions -> updateEngagementPanelAction -> content -> transcriptRenderer -> content -> transcriptSearchPanelRenderer -> body -> transcriptSegmentListRenderer -> initialSegments

                // Deep search function
                function findSegments(obj) {
                    if (!obj) return null;
                    if (obj.initialSegments) return obj.initialSegments;
                    if (Array.isArray(obj)) {
                        for (let item of obj) {
                            const found = findSegments(item);
                            if (found) return found;
                        }
                    }
                    if (typeof obj === 'object') {
                        for (let key in obj) {
                            const found = findSegments(obj[key]);
                            if (found) return found;
                        }
                    }
                    return null;
                }

                const segments = findSegments(transcriptData);
                if (segments) {
                    const text = segments.map(s => s.transcriptSegmentRenderer ? s.transcriptSegmentRenderer.snippet.runs.map(r => r.text).join('') : "").join(' ');
                    console.log("Transcript Extracted Successfully!");
                    console.log("Length:", text.length);
                    console.log("Snippet:", text.substring(0, 100));

                    // Save to file just in case
                    fs.writeFileSync('transcript_dump.json', JSON.stringify(transcriptData, null, 2));
                } else {
                    console.log("JSON captured but structure unknown.");
                    fs.writeFileSync('transcript_dump.json', JSON.stringify(transcriptData, null, 2));
                }
            } else {
                console.log("No 'get_transcript' response captured.");
            }

        } else {
            console.log("Button not found.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (browser) await browser.close();
    }
})();
