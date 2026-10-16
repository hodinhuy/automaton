import { BrowserClient } from "../src/browser/client.js";

async function runSearchDemo() {
  const client = new BrowserClient();

  const searchUrl = "https://en.wikipedia.org/wiki/Intelligent_agent";
  console.log(`1. Navigating to knowledge search: '${searchUrl}'...`);

  const res = await client.execute({
    action: "extract",
    url: searchUrl,
    task: "Research Intelligent Agent on Wikipedia",
  });

  console.log("2. Capturing visual screenshot...");
  const captureRes = await client.execute({
    action: "screenshot",
    task: "Capture Wikipedia Intelligent Agent page",
  });

  console.log("\n=== RESEARCH COMPLETED ===");
  console.log("Page Title:", captureRes.title);
  console.log("Final URL:", captureRes.url);
  console.log("Screenshot Path:", captureRes.screenshotPath);
  console.log("\nExtracted Knowledge (First 600 characters):\n", res.content?.slice(0, 600));
}

runSearchDemo().catch(console.error);
