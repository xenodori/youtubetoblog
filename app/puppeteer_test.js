const puppeteer = require('puppeteer');
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

(async () => {
    console.log("Launching browser...");
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        // Mobile User Agent sometimes makes it easier, but let's stick to desktop for now
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...');

        console.log("Navigating to:", url);
        await page.goto(url, { waitUntil: 'networkidle2' });

        console.log("Page Title:", await page.title());

        console.log("Extracting ytInitialPlayerResponse...");

        const playerResponse = await page.evaluate(() => {
            return window.ytInitialPlayerResponse;
        });

        if (playerResponse && playerResponse.captions) {
            const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
            console.log(`Found ${tracks.length} caption tracks.`);
            if (tracks.length > 0) {
                console.log("First track URL:", tracks[0].baseUrl);
                // We can fetch this URL (it's XML or JSON3)
            }
        } else {
            console.log("No captions found in ytInitialPlayerResponse.");
            // Try ytInitialData?
        }


        console.log("Looking for 'Show transcript' button...");

        // Try to click "more" in description if description is collapsed
        try {
            // Note: Selector validation is hard without seeing page.
            // Generic strategy: Look for button with text "Show transcript"
            // Or look for DOM elements.

            // Wait a bit
            await new Promise(r => setTimeout(r, 2000));

            // Expand description
            const expandButton = await page.$('#expand');
            if (expandButton) {
                console.log("Clicking expand description...");
                await expandButton.click();
                await new Promise(r => setTimeout(r, 1000));
            }

            // Find "Show transcript" button
            // It's usually a button inside ytd-video-description-transcript-section-renderer
            // OR just search for button with specific text/icon
            // The selector update frequently.

            // Let's try to find button by text content
            const buttons = await page.$$('button');
            let transcriptBtn = null;
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.textContent, btn);
                if (text && text.trim().includes("Show transcript")) {
                    transcriptBtn = btn;
                    break;
                }
            }

            if (!transcriptBtn) {
                // Try searching in ytd-button-renderer
                const renderings = await page.$$('ytd-button-renderer');
                for (const renderer of renderings) {
                    const text = await page.evaluate(el => el.textContent, renderer);
                    if (text && text.trim().includes("Show transcript")) {
                        transcriptBtn = renderer;
                        break;
                    }
                }
            }

            if (transcriptBtn) {
                console.log("Found Show transcript button. Clicking...");
                await transcriptBtn.click();
            } else {
                console.log("Could not find Show transcript button via text.");
                // Try specific selector for the engagement panel button
                // [target-id="engagement-panel-searchable-transcript"]
                /*
                const panelBtn = await page.$('[target-id="engagement-panel-searchable-transcript"]');
                if (panelBtn) {
                    await panelBtn.click();
                } else {
                    throw new Error("Transcript button missing");
                }
                */
            }

            // Wait for transcript panel
            console.log("Waiting for transcript segments...");
            await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 5000 });

            const segments = await page.$$('ytd-transcript-segment-renderer');
            console.log(`Found ${segments.length} segments.`);

            let fullText = "";
            for (const seg of segments) {
                const text = await page.evaluate(el => el.textContent, seg);
                // Clean up text (remove timestamps/newlines if mixed)
                // usually .segment-text class has the text
                const textEl = await seg.$('.segment-text');
                if (textEl) {
                    const t = await page.evaluate(el => el.textContent, textEl);
                    fullText += t + " ";
                } else {
                    fullText += text.replace(/\s+/g, ' ') + " ";
                }
            }

            console.log("Transcript extracted!");
            console.log("Length:", fullText.length);
            console.log("Snippet:", fullText.substring(0, 100));

        } catch (e) {
            console.error("Transcript Extraction Failed:", e.message);
            // Fallback: check if we can use youtube-transcript inside the browser context? No.
        }

    } catch (e) {
        console.error("Puppeteer Error:", e);
    } finally {
        if (browser) await browser.close();
        console.log("Done.");
    }
})();
