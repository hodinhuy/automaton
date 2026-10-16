/**
 * Telegram Userbot Session Generator
 *
 * Interactive CLI script to log in to Telegram via MTProto (GramJS)
 * and generate a persistent StringSession string for your Automaton digital employee.
 *
 * Usage:
 *   pnpm tsx scripts/login-telegram.ts
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("\n============================================================");
  console.log("   AUTOMATON TELEGRAM USERBOT SESSION GENERATOR (MTProto)   ");
  console.log("============================================================\n");
  console.log("LƯU Ý: Bạn cần lấy 'api_id' và 'api_hash' từ https://my.telegram.org\n");

  const envApiId = process.env.TELEGRAM_API_ID;
  const envApiHash = process.env.TELEGRAM_API_HASH;

  const apiIdStr = await rl.question(
    `1. Nhập API ID${envApiId ? ` (mặc định: ${envApiId})` : ""}: `,
  );
  const resolvedApiId = Number(apiIdStr.trim() || envApiId);

  if (isNaN(resolvedApiId) || !resolvedApiId) {
    console.error("❌ API ID không hợp lệ.");
    rl.close();
    process.exit(1);
  }

  const apiHashInput = await rl.question(
    `2. Nhập API Hash${envApiHash ? ` (mặc định: ${envApiHash})` : ""}: `,
  );
  const resolvedApiHash = apiHashInput.trim() || envApiHash;

  if (!resolvedApiHash) {
    console.error("❌ API Hash không được để trống.");
    rl.close();
    process.exit(1);
  }

  const phoneNumber = await rl.question(
    "3. Nhập số điện thoại Telegram (ví dụ: +84912345678): ",
  );
  if (!phoneNumber.trim()) {
    console.error("❌ Số điện thoại không được để trống.");
    rl.close();
    process.exit(1);
  }

  console.log("\n⏳ Đang kết nối tới Telegram servers...");

  try {
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions/index.js");

    const session = new StringSession("");
    const client = new TelegramClient(session, resolvedApiId, resolvedApiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => phoneNumber.trim(),
      password: async () => {
        return await rl.question("🔑 Nhập mật khẩu 2FA (Cloud Password nếu có): ");
      },
      phoneCode: async () => {
        return await rl.question("📩 Nhập mã xác nhận vừa gửi về Telegram/SMS: ");
      },
      onError: (err) => console.error("Lỗi:", err),
    });

    console.log("\n✅ Đăng nhập Telegram thành công!");
    const me: any = await client.getMe();
    console.log(`👤 Tài khoản: ${[me.firstName, me.lastName].filter(Boolean).join(" ")} (@${me.username || "không có username"}, ID: ${me.id})`);

    const sessionString = client.session.save() as unknown as string;

    console.log("\n============================================================");
    console.log("   SESSION STRING CỦA BẠN (LƯU LẠI VÀ BẢO MẬT):            ");
    console.log("============================================================\n");
    console.log(sessionString);
    console.log("\n============================================================\n");

    const saveChoice = await rl.question("Lưu cấu hình này vào file .env? (y/n) [mặc định: y]: ");
    if (saveChoice.toLowerCase().trim() !== "n") {
      const envPath = path.join(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }

      const updates: Record<string, string> = {
        TELEGRAM_ENABLED: "true",
        TELEGRAM_MODE: "userbot",
        TELEGRAM_API_ID: String(resolvedApiId),
        TELEGRAM_API_HASH: resolvedApiHash,
        TELEGRAM_SESSION_STRING: sessionString,
      };

      for (const [key, val] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += `\n${key}=${val}`;
        }
      }

      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
      console.log(`✅ Đã cập nhật cấu hình vào ${envPath}`);
    }

    await client.disconnect();
  } catch (err: any) {
    console.error("❌ Quá trình đăng nhập thất bại:", err?.message || err);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
