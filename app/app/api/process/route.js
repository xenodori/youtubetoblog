import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import puppeteer from "puppeteer";
import ytdl from "@distube/ytdl-core";
import fs from "fs";
import path from "path";
import os from "os";

// Use the working model found in testing
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

export async function POST(req) {
    try {
        const { url, manualTranscript } = await req.json();

        if (!url && !manualTranscript) {
            return Response.json({ error: "URL or Manual Transcript is required" }, { status: 400 });
        }

        // 1. Get Transcript via Puppeteer (Robust Fallback)
        let transcript = manualTranscript || '';
        let images = [];
        let browser = null;

        // Only try to fetch transcript if we don't have a manual one
        if (!transcript) {
            try {
                console.log("Launching Puppeteer for:", url);
                browser = await puppeteer.launch({
                    headless: "new",
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                const page = await browser.newPage();

                // Set User Agent
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                // Go to video page with english param, though it might be ignored
                const urlWithLang = url + (url.includes('?') ? '&' : '?') + 'hl=en';
                await page.goto(urlWithLang, { waitUntil: 'networkidle2' });

                // 1. Scroll down to trigger lazy loading
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

                // 3. Click "Show transcript" / "스크립트"
                console.log("Looking for transcript button...");
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
                    console.log("Clicked transcript button. Waiting for content...");

                    // Wait for some time for the panel to render
                    await new Promise(r => setTimeout(r, 2000));

                    // Extract with Shadow DOM support
                    transcript = await page.evaluate(() => {
                        // Use a TreeWalker to flatten the DOM including Shadow Roots
                        function getAllSegments(root) {
                            let segments = [];
                            // Check if current node is a segment
                            if (root.tagName && root.tagName.toLowerCase() === 'ytd-transcript-segment-renderer') {
                                segments.push(root);
                            }

                            // Check Shadow Root
                            if (root.shadowRoot) {
                                segments = segments.concat(getAllSegments(root.shadowRoot));
                            }

                            // Check Children
                            if (root.children) {
                                for (let child of root.children) {
                                    segments = segments.concat(getAllSegments(child));
                                }
                            }
                            return segments;
                        }

                        // Find the engagement panel to narrow down search
                        const panel = document.querySelector('[target-id="engagement-panel-searchable-transcript"]');
                        const searchRoot = panel || document.body;

                        // Helper to get text from a segment (usually in .segment-text class)
                        function getSegmentText(segment) {
                            const textDiv = segment.querySelector('.segment-text');
                            if (textDiv) return textDiv.innerText;
                            if (segment.shadowRoot) {
                                const shadowText = segment.shadowRoot.querySelector('.segment-text');
                                if (shadowText) return shadowText.innerText;
                            }
                            return segment.innerText;
                        }

                        // Since full recursive distinct is heavy, let's try a targeted drill-down first
                        // 1. ytd-transcript-renderer
                        // 2. #segments-container

                        // Attempt to find ytd-transcript-renderer using a walker
                        function findTranscriptRenderer(root) {
                            if (root.tagName && root.tagName.toLowerCase() === 'ytd-transcript-renderer') return root;
                            if (root.shadowRoot) {
                                const found = findTranscriptRenderer(root.shadowRoot);
                                if (found) return found;
                            }
                            if (root.children) {
                                for (let child of root.children) {
                                    const found = findTranscriptRenderer(child);
                                    if (found) return found;
                                }
                            }
                            return null;
                        }

                        const renderer = findTranscriptRenderer(searchRoot);
                        if (renderer) {
                            // If we found the renderer, the segments are likely in its shadowDOM -> #segments-container
                            // Accessing internal structure directly if possible
                            // renderer.data might be available but let's stick to DOM

                            // Simple recursive search from renderer specifically
                            const segments = getAllSegments(renderer);
                            return segments.map(s => getSegmentText(s)).join(' ').trim();
                        }

                        // Fallback: brute force all segments in searchRoot
                        const segments = getAllSegments(searchRoot);
                        return segments.map(s => getSegmentText(s)).join(' ').trim();
                    });

                    console.log("Extracted length:", transcript.length);
                } else {
                    // Fallback logic for captionUrl (keep existing)
                    console.log("Button not found. Trying ytInitialPlayerResponse...");
                    const captionUrl = await page.evaluate(() => {
                        if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions && window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer) {
                            const tracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
                            if (tracks && tracks.length > 0) {
                                const ko = tracks.find(t => t.languageCode === 'ko');
                                return ko ? ko.baseUrl : tracks[0].baseUrl;
                            }
                        }
                        return null;
                    });

                    if (captionUrl) {
                        console.log("Found caption URL, fetching via page context...");
                        const xml = await page.evaluate(async (url) => {
                            const res = await fetch(url);
                            return await res.text();
                        }, captionUrl);

                        // Parse XML
                        const regex = /<text[^>]*>(.*?)<\/text>/g;
                        let match;
                        while ((match = regex.exec(xml)) !== null) {
                            let text = match[1];
                            text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                            transcript += text + " ";
                        }
                    }
                }

                // Screenshot Capture
                try {
                    console.log("Attempting screenshots...");
                    // 1. Unmute/Play if needed (autoplaying usually works, but ensure visibility)
                    // Hide overlays
                    await page.evaluate(() => {
                        const style = document.createElement('style');
                        style.innerHTML = `
                            .ytp-chrome-top, .ytp-chrome-bottom, .ytp-gradient-top, .ytp-gradient-bottom, .video-stream-html5-overlays { display: none !important; }
                        `;
                        document.head.appendChild(style);
                    });

                    const duration = await page.evaluate(() => document.querySelector('video') ? document.querySelector('video').duration : 0);
                    const screenshots = [];

                    if (duration > 0) {
                        const times = [duration * 0.2, duration * 0.5, duration * 0.8]; // 20%, 50%, 80%
                        for (const time of times) {
                            await page.evaluate((t) => {
                                const video = document.querySelector('video');
                                if (video) {
                                    video.currentTime = t;
                                    // video.pause(); // Maybe pause to get clear shot?
                                }
                            }, time);
                            await new Promise(r => setTimeout(r, 1000)); // Wait for seek
                            const buffer = await page.screenshot({ type: 'jpeg', quality: 80, captureBeyondViewport: false });
                            screenshots.push(`data:image/jpeg;base64,${buffer.toString('base64')}`);
                        }
                    }
                    images = screenshots;

                } catch (e) {
                    console.error("Screenshot error:", e);
                }

            } catch (e) {
                console.error("Transcript/Puppeteer Error:", e);
            } finally {
                if (browser) await browser.close();
            }
        }

        // --- AUDIO FALLBACK START ---
        if (!transcript || transcript.trim().length === 0) {
            console.log("Transcript not found. Attempting audio download...");

            try {
                // 1. Download Audio
                const videoId = ytdl.getURLVideoID(url);
                const tempFilePath = path.join(os.tmpdir(), `audio_${videoId}_${Date.now()}.mp3`);

                await new Promise((resolve, reject) => {
                    ytdl(url, { filter: 'audioonly', quality: 'lowestaudio' })
                        .pipe(fs.createWriteStream(tempFilePath))
                        .on('finish', resolve)
                        .on('error', reject);
                });

                console.log("Audio downloaded:", tempFilePath);

                // 2. Upload to Gemini
                const uploadResponse = await fileManager.uploadFile(tempFilePath, {
                    mimeType: "audio/mp3",
                    displayName: `Audio for ${videoId}`,
                });

                console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);

                // 3. Generate Content from Audio
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent([
                    {
                        text: `
                        다음은 유튜브 영상의 오디오 파일입니다. 이것을 듣고 분석하여 **네이버 블로그 포스팅**을 작성해주세요.
                        
                        **작성 가이드라인**:
                        1. **말투**: 영상 속 화자의 톤앤매너를 유지하되, 블로그 이웃에게 말하듯 친근하고 정성스러운 "해요체"를 사용하세요. (이모지 적절히 사용)
                        2. **구조**:
                           - **제목**: 클릭을 부르는 매력적인 제목 3가지를 추천해주세요.
                           - **도입부**: 흥미를 유발하고 공감을 이끌어내는 인트로.
                           - **본문**: 소제목으로 구분하고, 핵심 내용은 불렛 포인트로 정리하여 가독성을 높이세요.
                           - **결론**: 요약 및 마무리 인사.
                        3. **내용**: 오디오의 내용을 충실히 반영하여 풍부하게 작성해주세요.
                        `
                    },
                    {
                        fileData: {
                            mimeType: uploadResponse.file.mimeType,
                            fileUri: uploadResponse.file.uri
                        }
                    }
                ]);

                // Cleanup temp file
                fs.unlinkSync(tempFilePath);

                const responseText = result.response.text();
                return Response.json({ markdown: responseText, images: images }); // Return early

            } catch (audioError) {
                console.error("Audio Fallback Error:", audioError);
                return Response.json({ error: "자막을 찾을 수 없고, 오디오 분석 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 직접 내용을 입력해주세요." }, { status: 500 });
            }
        }
        // --- AUDIO FALLBACK END ---


        // 2. Analyze with Gemini (Text based)
        // Use the working model 'gemini-1.5-flash'
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
    다음은 유튜브 영상의 자막 스크립트입니다. 이것을 바탕으로 **네이버 블로그 포스팅**을 작성해주세요.

    **작성 가이드라인**:
    1. **말투**: 영상 속 화자의 톤앤매너를 유지하되, 블로그 이웃에게 말하듯 친근하고 정성스러운 "해요체"를 사용하세요. (이모지 적절히 사용)
    2. **구조**:
       - **제목**: 클릭을 부르는 매력적인 제목 3가지를 추천해주세요.
       - **도입부**: 흥미를 유발하고 공감을 이끌어내는 인트로.
       - **본문**: 소제목으로 구분하고, 핵심 내용은 불렛 포인트로 정리하여 가독성을 높이세요.
       - **결론**: 요약 및 마무리 인사.
    3. **이미지 배치**: 본문 중간중간 내용이 전환되는 지점에 [이미지: "이미지 설명"] 이라고 표시해주세요. (실제 이미지는 넣지 말고 텍스트로만 표시)
    
    **스크립트**:
    ${transcript.substring(0, 30000)} // Limit to reasonable length
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return Response.json({ markdown: text, images: images });

    } catch (error) {
        console.error("API Error:", error);
        return Response.json({ error: `처리 중 오류가 발생했습니다: ${error.message}` }, { status: 500 });
    }
}
