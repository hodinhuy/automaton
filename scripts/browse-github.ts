import { BrowserClient } from "../src/browser/client.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function browseGitHub() {
  const client = new BrowserClient();

  console.log("👉 1. Điều hướng đến GitHub Trending (https://github.com/trending)...");
  const navRes = await client.execute({
    action: "navigate",
    url: "https://github.com/trending",
  });
  console.log(`✅ Đã mở: "${navRes.title}" (${navRes.url})`);

  console.log("⏳ Chờ 2.5 giây để bạn xem trực tiếp trên màn hình...");
  await sleep(2500);

  console.log("👉 2. Đang cuộn xuống đợt 1 (Xem các repo trending đầu tiên)...");
  await client.execute({
    action: "scroll" as any,
    task: "scroll down",
  });

  await sleep(2000);

  console.log("👉 3. Đang cuộn xuống đợt 2 (Xem các repo tiếp theo)...");
  await client.execute({
    action: "scroll" as any,
    task: "scroll down",
  });

  await sleep(2000);

  console.log("👉 4. Đang cuộn xuống đợt 3...");
  await client.execute({
    action: "scroll" as any,
    task: "scroll down",
  });

  await sleep(2000);

  console.log("👉 5. Chụp ảnh màn hình lưu lại...");
  const snapRes = await client.execute({
    action: "screenshot",
  });

  console.log("👉 6. Trích xuất thông tin các repo đang HOT trên GitHub...");
  const extractRes = await client.execute({
    action: "extract",
  });

  console.log("\n================ KẾT QUẢ TRENDING GITHUB ================");
  console.log("Tiêu đề:", snapRes.title);
  console.log("Ảnh chụp tại:", snapRes.screenshotPath);
  console.log("Nội dung trích xuất (vắn tắt):\n");
  const lines = (extractRes.content || "").split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("Skip to") && !l.startsWith("Sign"));
  console.log(lines.slice(0, 30).join("\n"));
}

browseGitHub().catch(console.error);
