/**
 * Quick Telegram Verification Test
 *
 * Connects to Telegram using the credentials saved in .env / config,
 * sends a test ping message to the Creator, and listens for a response
 * to verify 2-way communication.
 *
 * Usage:
 *   pnpm tsx scripts/test-telegram.ts
 */

import fs from "node:fs";
import { TelegramConnector } from "../src/social/channels/telegram.js";
import { SocialConnectorHub } from "../src/social/hub.js";

// Load .env
if (fs.existsSync(".env")) {
  try {
    (process as any).loadEnvFile?.(".env");
  } catch {
    const envContent = fs.readFileSync(".env", "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

async function main() {
  console.log("\n============================================================");
  console.log("       KIỂM TRA KẾT NỐI VÀ GỬI NHẬN TIN NHẮN TELEGRAM       ");
  console.log("============================================================\n");

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION_STRING;
  const creatorId = process.env.TELEGRAM_CREATOR_ID || "1932955918";

  if (!apiId || !apiHash || !sessionString) {
    console.error("❌ Thiếu thông tin Telegram trong .env. Hãy kiểm tra lại file .env.");
    process.exit(1);
  }

  console.log("1. Đang kết nối tới Telegram Userbot...");
  const connector = new TelegramConnector({
    enabled: true,
    mode: "userbot",
    apiId,
    apiHash,
    sessionString,
    creatorTelegramId: creatorId,
  });

  const hub = new SocialConnectorHub();
  hub.registerChannel(connector);

  await hub.initAll();

  const status = connector.getStatus();
  if (!status.connected) {
    console.error("❌ Không thể kết nối tới Telegram.");
    process.exit(1);
  }

  console.log("✅ Kết nối Telegram thành công!");
  console.log("   Tài khoản:", status.details?.self);
  console.log(`   Người quản lý (Creator ID): ${creatorId}\n`);

  console.log(`2. Đang gửi tin nhắn thử nghiệm tới sếp (${creatorId})...`);
  const sendResult = await hub.sendMessage(
    "telegram",
    creatorId,
    "🔔 [Automaton Check-in]: Chào sếp! Kênh Telegram của em đã kết nối thành công và đang hoạt động tốt. Sếp hãy nhắn lại 1 tin bất kỳ vào đây để kiểm tra chiều nhận tin nhắn nhé!",
  );

  if (sendResult.success) {
    console.log(`✅ Đã gửi tin nhắn thành công! (Message ID: ${sendResult.messageId})\n`);
  } else {
    console.error(`❌ Gửi tin nhắn thất bại: ${sendResult.error}`);
    console.log("LƯU Ý: Nếu gửi cho chính mình, bạn có thể kiểm tra mục 'Saved Messages' trên Telegram.\n");
  }

  console.log("3. Đang lắng nghe phản hồi từ Telegram (trong 45 giây)...");
  console.log("   Hãy mở Telegram và nhắn 1 tin cho tài khoản này...");

  let received = false;

  hub.onIncomingMessage(async (msg) => {
    received = true;
    console.log("\n============================================================");
    console.log(`📩 NHẬN ĐƯỢC TIN NHẮN MỚI TỪ [${msg.senderName}] (ID: ${msg.senderId}):`);
    console.log(`   Nội dung: "${msg.content}"`);
    console.log("============================================================\n");

    console.log("Đang tự động gửi phản hồi xác nhận...");
    if (msg.reply) {
      await msg.reply(`✅ Em đã nhận được tin nhắn: "${msg.content}". Kênh giao tiếp 2 chiều hoạt động 100% hoàn hảo!`);
      console.log("✅ Đã gửi phản hồi thành công!");
    }

    setTimeout(async () => {
      console.log("\nKiểm tra hoàn tất. Đang đóng kết nối...");
      await hub.stopAll();
      process.exit(0);
    }, 2000);
  });

  // Timeout after 45s
  setTimeout(async () => {
    if (!received) {
      console.log("\n⏳ Hết thời gian chờ (45s). Đang đóng kết nối.");
      await hub.stopAll();
      process.exit(0);
    }
  }, 45000);
}

main().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});
