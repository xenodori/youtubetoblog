const puppeteer = require('puppeteer');
const url = "https://youtu.be/7D0JGR1ywfg?si=65wOEdS8knF-mcdp";

(async () => {
    console.log("Launching Puppeteer for UI Extraction...");
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const urlWithLang = url + (url.includes('?') ? '&' : '?') + 'hl=en';
        console.log("Navigating to:", urlWithLang);

        await page.goto(urlWithLang, { waitUntil: 'networkidle2' });
        console.log("Page Title:", await page.title());

        // SCROLLING
        console.log("Scrolling down...");
        await page.evaluate(() => {
            window.scrollBy(0, 500);
        });
        await new Promise(r => setTimeout(r, 2000));

        // Wait for description
        console.log("Waiting for #description-classes...");
        try {
            // This is the container for description
            await page.waitForSelector('#description-inner', { timeout: 5000 });
        } catch (e) { console.log("Description selector timeout"); }

        // Try expanding
        console.log("Attempting to expand description...");
        try {
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, tp-yt-paper-button, #expand'));
                // Look for "...more" or "...더보기"
                const moreBtn = buttons.find(b => {
                    const t = b.innerText.trim();
                    return t.includes("더보기") || t.includes("more");
                });
                if (moreBtn) {
                    moreBtn.click();
                    console.log("Clicked More button");
                } else {
                    // Fallback to ID
                    const expand = document.querySelector('#expand');
                    if (expand) expand.click();
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { }

        console.log("Looking for 'Show transcript' or '스크립트' button...");
        const transcriptText = await page.evaluate(async () => {
            // Helper to find button
            const buttons = Array.from(document.querySelectorAll('button, ytd-button-renderer'));

            const target = buttons.find(b => {
                const t = b.innerText && b.innerText.toLowerCase();
                return t && (t.includes("show transcript") || t.includes("스크립트"));
            });

            if (target) {
                target.click();
                return "Clicked";
            }
            return "Not Found";
        });

        console.log("Button Status:", transcriptText);

        if (transcriptText === "Clicked") {
            console.log("Waiting for transcript panel...");
            try {
                // Wait for the segment renderer
                await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 10000 });

                const fullText = await page.evaluate(() => {
                    const segments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
                    return segments.map(seg => {
                        // segment-text usually holds the text
                        const el = seg.querySelector('.segment-text');
                        return el ? el.innerText : "";
                    }).join(' ');
                });

                console.log("Success! Transcript Length:", fullText.length);
                console.log("Snippet:", fullText.substring(0, 100));

            } catch (e) {
                console.log("Transcript panel load timeout:", e.message);
            }
        } else {
            // Log visible text to see if we are blocked/login wall
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
            console.log("Body Text Snippet:", bodyText);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (browser) await browser.close();
    }
})();
