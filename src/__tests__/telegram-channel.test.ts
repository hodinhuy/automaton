import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { TelegramConnector } from "../social/channels/telegram.js";
import { SocialConnectorHub } from "../social/hub.js";
import type { IncomingMessage } from "../social/types.js";

describe("TelegramConnector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws descriptive error in bot mode if token is missing", async () => {
    const connector = new TelegramConnector({
      enabled: true,
      mode: "bot",
    });

    await expect(connector.init()).rejects.toThrow(/Telegram Bot Token is required/);
  });

  it("throws descriptive error in userbot mode if MTProto credentials are missing", async () => {
    const connector = new TelegramConnector({
      enabled: true,
      mode: "userbot",
    });

    await expect(connector.init()).rejects.toThrow(/Telegram Userbot mode requires/);
  });

  it("initializes successfully in bot mode when getMe succeeds", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/getMe")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              id: 999888,
              is_bot: true,
              first_name: "Test",
              username: "test_digital_bot",
            },
          }),
        };
      }
      if (url.includes("/getUpdates")) {
        // Return empty updates and abort signal
        return {
          ok: true,
          json: async () => ({ ok: true, result: [] }),
        };
      }
      return { ok: false, status: 404 };
    });

    global.fetch = mockFetch as any;

    const connector = new TelegramConnector({
      enabled: true,
      mode: "bot",
      botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      creatorTelegramId: "111222",
    });

    await connector.init();
    const status = connector.getStatus();

    expect(status.connected).toBe(true);
    expect(status.details?.self).toEqual({
      id: "999888",
      username: "test_digital_bot",
      name: "Test",
    });

    await connector.stop();
    expect(connector.getStatus().connected).toBe(false);
  });

  it("sends message via Telegram Bot API with correct payload", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url.includes("/getMe")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: { id: 999888, username: "test_bot" },
          }),
        };
      }
      if (url.includes("/sendMessage")) {
        const body = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              message_id: 42,
              chat: { id: body.chat_id },
              text: body.text,
            },
          }),
        };
      }
      if (url.includes("/getUpdates")) {
        return { ok: true, json: async () => ({ ok: true, result: [] }) };
      }
      return { ok: false, status: 404 };
    });

    global.fetch = mockFetch as any;

    const connector = new TelegramConnector({
      enabled: true,
      mode: "bot",
      botToken: "fake-token",
    });

    await connector.init();

    const result = await connector.sendMessage("12345", "Hello from digital employee!", {
      replyToId: "99",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("42");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botfake-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "12345",
          text: "Hello from digital employee!",
          reply_to_message_id: 99,
        }),
      }),
    );

    await connector.stop();
  });
});

describe("SocialConnectorHub", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id TEXT PRIMARY KEY,
        from_address TEXT NOT NULL,
        to_address TEXT,
        content TEXT NOT NULL,
        received_at TEXT NOT NULL,
        processed_at TEXT,
        reply_to TEXT,
        raw_content TEXT,
        status TEXT DEFAULT 'received',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3
      );
      CREATE TABLE IF NOT EXISTS wake_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        reason TEXT NOT NULL,
        payload TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        consumed_at TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("registers connector and routes incoming message to SQLite inbox and wake event", async () => {
    const wakeRequests: string[] = [];
    const hub = new SocialConnectorHub({
      db,
      onWakeRequest: (reason) => wakeRequests.push(reason),
    });

    let messageCallback: ((msg: IncomingMessage) => Promise<void>) | undefined;

    const mockConnector = {
      channelName: "telegram" as const,
      init: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ connected: true, channel: "telegram" }),
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: "out-101" }),
      onMessage: vi.fn().mockImplementation((handler) => {
        messageCallback = handler;
      }),
    };

    hub.registerChannel(mockConnector);
    expect(hub.getChannel("telegram")).toBeDefined();

    // Simulate an incoming Telegram message
    const incoming: IncomingMessage = {
      id: "tg_msg_777",
      channel: "telegram",
      senderId: "123456",
      senderName: "Hugo Boss",
      chatId: "123456",
      isCreator: true,
      content: "Báo cáo doanh thu hôm nay cho tôi",
      threadType: "direct",
      timestamp: new Date().toISOString(),
    };

    expect(messageCallback).toBeDefined();
    await messageCallback!(incoming);

    // Verify inbox_messages table record
    const row = db.prepare("SELECT * FROM inbox_messages WHERE id = ?").get("tg_msg_777") as any;
    expect(row).toBeDefined();
    expect(row.from_address).toBe("telegram:123456");
    expect(row.content).toContain("[TELEGRAM from Hugo Boss]: Báo cáo doanh thu hôm nay cho tôi");
    expect(row.status).toBe("received");

    // Verify wake_events table record
    const wakeRow = db.prepare("SELECT * FROM wake_events WHERE source = 'social'").get() as any;
    expect(wakeRow).toBeDefined();
    expect(wakeRow.reason).toContain("Hugo Boss");
    expect(wakeRequests.length).toBe(1);

    // Test sending message through hub
    const sendResult = await hub.sendMessage("telegram", "123456", "Dạ đây là báo cáo...");
    expect(sendResult.success).toBe(true);
    expect(mockConnector.sendMessage).toHaveBeenCalledWith("123456", "Dạ đây là báo cáo...", undefined);
  });

  it("returns error when sending to an unregistered channel", async () => {
    const hub = new SocialConnectorHub({ db });
    const result = await hub.sendMessage("discord", "chan-1", "Hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Channel [discord] is not registered");
  });
});
