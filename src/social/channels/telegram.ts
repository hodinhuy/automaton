/**
 * Telegram Channel Connector
 *
 * Implements SocialChannelConnector for Telegram supporting two modes:
 * 1. "bot": Telegram Bot API via standard HTTPS long-polling (zero MTProto complexity).
 * 2. "userbot": Real Telegram User Account via GramJS MTProto with human-like delays.
 */

import { createLogger } from "../../observability/logger.js";
import type {
  SocialChannelConnector,
  IncomingMessage,
  SendMessageResult,
  TelegramChannelConfig,
  ChannelStatus,
} from "../types.js";

const logger = createLogger("social.telegram");

export class TelegramConnector implements SocialChannelConnector {
  readonly channelName = "telegram" as const;
  private config: TelegramChannelConfig;
  private isConnected = false;
  private isPolling = false;
  private pollAbortController?: AbortController;
  private lastUpdateId = 0;
  private messageHandlers: ((msg: IncomingMessage) => Promise<void>)[] = [];

  // GramJS Userbot client reference
  private gramClient?: any;
  private selfAccountInfo?: { id: string; username?: string; name?: string };

  constructor(config: TelegramChannelConfig) {
    this.config = config;
  }

  public onMessage(handler: (msg: IncomingMessage) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  public async init(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Telegram channel is disabled in configuration.");
      return;
    }

    if (this.config.mode === "userbot") {
      await this.initUserbotMode();
    } else {
      await this.initBotMode();
    }
  }

  public async stop(): Promise<void> {
    this.isConnected = false;

    // Stop Bot API polling if active
    if (this.pollAbortController) {
      this.isPolling = false;
      this.pollAbortController.abort();
      this.pollAbortController = undefined;
    }

    // Stop GramJS Userbot if connected
    if (this.gramClient) {
      try {
        await this.gramClient.disconnect();
        logger.info("Telegram Userbot disconnected.");
      } catch (err: any) {
        logger.warn(`Error disconnecting Telegram Userbot: ${err?.message}`);
      }
      this.gramClient = undefined;
    }

    logger.info("Telegram channel stopped.");
  }

  public getStatus(): ChannelStatus {
    return {
      connected: this.isConnected,
      channel: "telegram",
      mode: this.config.mode,
      details: {
        self: this.selfAccountInfo,
        handlersCount: this.messageHandlers.length,
      },
    };
  }

  public async sendMessage(
    targetId: string,
    content: string,
    options?: { replyToId?: string },
  ): Promise<SendMessageResult> {
    if (!this.isConnected) {
      return {
        success: false,
        error: "Telegram connector is not connected. Call init() first.",
      };
    }

    try {
      if (this.config.mode === "userbot" && this.gramClient) {
        return await this.sendViaUserbot(targetId, content, options);
      } else {
        return await this.sendViaBotApi(targetId, content, options);
      }
    } catch (err: any) {
      logger.error("Failed to send Telegram message", err);
      return {
        success: false,
        error: err?.message || String(err),
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Bot Mode (Telegram Bot API - HTTPS Long-Polling)
  // ─────────────────────────────────────────────────────────────

  private async initBotMode(): Promise<void> {
    const token = this.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error(
        "Telegram Bot Token is required for bot mode. Set TELEGRAM_BOT_TOKEN in env or config.",
      );
    }
    this.config.botToken = token;

    // Verify token by calling getMe
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = (await resp.json()) as any;
      if (!data.ok) {
        throw new Error(`Telegram getMe failed: ${data.description}`);
      }

      this.selfAccountInfo = {
        id: String(data.result.id),
        username: data.result.username,
        name: [data.result.first_name, data.result.last_name].filter(Boolean).join(" "),
      };

      this.isConnected = true;
      logger.info(
        `Telegram Bot connected as @${this.selfAccountInfo.username} (ID: ${this.selfAccountInfo.id})`,
      );

      // Start long-polling in the background
      this.startBotPolling();
    } catch (err: any) {
      this.isConnected = false;
      logger.error("Failed to initialize Telegram Bot Mode", err);
      throw err;
    }
  }

  private startBotPolling(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollAbortController = new AbortController();

    const poll = async () => {
      while (this.isPolling && this.isConnected) {
        try {
          const token = this.config.botToken;
          const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.lastUpdateId}&timeout=30`;

          const resp = await fetch(url, {
            signal: this.pollAbortController?.signal,
          });

          if (!resp.ok) {
            logger.warn(`Telegram polling returned HTTP ${resp.status}`);
            await this.sleep(3000);
            continue;
          }

          const data = (await resp.json()) as any;
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id + 1);
              await this.handleBotUpdate(update);
            }
          }
        } catch (err: any) {
          if (err?.name === "AbortError" || !this.isPolling) {
            break;
          }
          logger.warn(`Telegram polling error: ${err?.message}, retrying in 5s...`);
          await this.sleep(5000);
        }
      }
    };

    poll().catch((err) => {
      logger.error("Telegram polling loop crashed", err);
    });
  }

  private async handleBotUpdate(update: any): Promise<void> {
    const message = update.message || update.channel_post;
    if (!message || !message.text) return;

    const from = message.from || {};
    const chat = message.chat || {};
    const fromId = String(from.id || chat.id);
    const chatId = String(chat.id);
    const senderName = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "Telegram User";
    const creatorId = this.config.creatorTelegramId ? String(this.config.creatorTelegramId) : undefined;
    const isCreator = Boolean(creatorId && fromId === creatorId);

    // Whitelist check if configured
    if (this.config.allowedChatIds && this.config.allowedChatIds.length > 0) {
      const allowed = this.config.allowedChatIds.some((id) => String(id) === chatId || String(id) === fromId);
      if (!allowed && !isCreator) {
        logger.debug(`Ignored message from unlisted chat ${chatId}`);
        return;
      }
    }

    const incoming: IncomingMessage = {
      id: `tg_bot_${message.message_id}`,
      channel: "telegram",
      senderId: fromId,
      senderName,
      senderUsername: from.username,
      chatId,
      isCreator,
      content: message.text,
      threadType: chat.type === "private" ? "direct" : "group",
      timestamp: new Date((message.date || Date.now() / 1000) * 1000).toISOString(),
      replyToId: message.reply_to_message ? String(message.reply_to_message.message_id) : undefined,
      metadata: {
        chatTitle: chat.title,
        chatType: chat.type,
      },
      reply: async (text: string) => {
        return this.sendMessage(chatId, text, {
          replyToId: String(message.message_id),
        });
      },
    };

    await this.dispatchToHandlers(incoming);
  }

  private async sendViaBotApi(
    targetId: string,
    content: string,
    options?: { replyToId?: string },
  ): Promise<SendMessageResult> {
    const token = this.config.botToken;
    const body: Record<string, unknown> = {
      chat_id: targetId,
      text: content,
    };
    if (options?.replyToId) {
      body.reply_to_message_id = Number(options.replyToId);
    }

    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as any;
    if (!data.ok) {
      return {
        success: false,
        error: data.description || "Failed to send message via Telegram Bot API",
      };
    }

    return {
      success: true,
      messageId: String(data.result?.message_id),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Userbot Mode (MTProto via GramJS)
  // ─────────────────────────────────────────────────────────────

  private async initUserbotMode(): Promise<void> {
    const apiIdStr = this.config.apiId || process.env.TELEGRAM_API_ID;
    const apiHash = this.config.apiHash || process.env.TELEGRAM_API_HASH;
    const sessionString = this.config.sessionString || process.env.TELEGRAM_SESSION_STRING;

    if (!apiIdStr || !apiHash || !sessionString) {
      throw new Error(
        "Telegram Userbot mode requires TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION_STRING. Run 'pnpm tsx scripts/login-telegram.ts' to generate your session string.",
      );
    }

    const apiId = Number(apiIdStr);
    if (isNaN(apiId)) {
      throw new Error(`Invalid TELEGRAM_API_ID: ${apiIdStr}`);
    }

    logger.info("Initializing Telegram Userbot via GramJS MTProto...");

    try {
      const { TelegramClient } = await import("telegram");
      const { StringSession } = await import("telegram/sessions/index.js");
      const { NewMessage } = await import("telegram/events/index.js");

      const session = new StringSession(sessionString);
      const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
      });

      await client.connect();

      const me: any = await client.getMe();
      if (!me) {
        throw new Error("Telegram MTProto authentication failed. Check session string.");
      }

      this.selfAccountInfo = {
        id: String(me.id),
        username: me.username,
        name: [me.firstName, me.lastName].filter(Boolean).join(" "),
      };

      this.gramClient = client;
      this.isConnected = true;
      logger.info(
        `Telegram Userbot connected as real user: ${this.selfAccountInfo.name} (@${this.selfAccountInfo.username || "no-username"}, ID: ${this.selfAccountInfo.id})`,
      );

      // Listen for incoming messages
      client.addEventHandler(async (event: any) => {
        try {
          const message = event.message;
          // Ignore empty messages or messages sent by ourselves
          if (!message || message.out) return;

          const text = message.text || message.message || "";
          if (!text) return;

          const sender = await message.getSender();
          const senderId = sender?.id ? String(sender.id) : String(message.senderId || "");
          const senderName = sender
            ? [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.title || sender.username || "Telegram User"
            : "Telegram User";

          const isGroup = Boolean(message.isGroup || message.isChannel);
          const chatId = String(message.chatId || senderId);
          const creatorId = this.config.creatorTelegramId ? String(this.config.creatorTelegramId) : undefined;
          const isCreator = Boolean(creatorId && senderId === creatorId);

          // Allowed chats filter if present
          if (this.config.allowedChatIds && this.config.allowedChatIds.length > 0) {
            const allowed = this.config.allowedChatIds.some((id) => String(id) === chatId || String(id) === senderId);
            if (!allowed && !isCreator) {
              return;
            }
          }

          const incoming: IncomingMessage = {
            id: `tg_user_${message.id}`,
            channel: "telegram",
            senderId,
            senderName,
            senderUsername: sender?.username,
            chatId,
            isCreator,
            content: text,
            threadType: isGroup ? "group" : "direct",
            timestamp: new Date((message.date || Date.now() / 1000) * 1000).toISOString(),
            replyToId: message.replyTo?.replyToMsgId ? String(message.replyTo.replyToMsgId) : undefined,
            metadata: {
              isChannel: message.isChannel,
              isGroup: message.isGroup,
            },
            reply: async (replyText: string) => {
              return this.sendMessage(chatId, replyText, {
                replyToId: String(message.id),
              });
            },
          };

          await this.dispatchToHandlers(incoming);
        } catch (err: any) {
          logger.error("Error processing Userbot message event", err);
        }
      }, new NewMessage({}));
    } catch (err: any) {
      this.isConnected = false;
      logger.error("Failed to connect Telegram Userbot", err);
      throw err;
    }
  }

  private async sendViaUserbot(
    targetId: string,
    content: string,
    options?: { replyToId?: string },
  ): Promise<SendMessageResult> {
    if (!this.gramClient) {
      return { success: false, error: "GramJS client not initialized" };
    }

    // Human typing simulation (random delay 1 - 2.5 seconds)
    const typingDelay = this.config.typingDelayMs ?? (1000 + Math.floor(Math.random() * 1500));
    if (typingDelay > 0) {
      await this.sleep(typingDelay);
    }

    const peer = /^\d+$/.test(targetId) || /^-?\d+$/.test(targetId)
      ? Number(targetId)
      : targetId;

    const result = await this.gramClient.sendMessage(peer, {
      message: content,
      replyTo: options?.replyToId ? Number(options.replyToId) : undefined,
    });

    return {
      success: true,
      messageId: String(result?.id),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Helper methods
  // ─────────────────────────────────────────────────────────────

  private async dispatchToHandlers(message: IncomingMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (err: any) {
        logger.error(`Handler error for Telegram message ${message.id}`, err);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
