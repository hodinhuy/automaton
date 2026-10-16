/**
 * Social Connector Hub
 *
 * Central omnichannel hub that coordinates incoming and outgoing communication
 * across Telegram, Zalo, Discord, and other channels.
 * Normalizes messages into SQLite inbox_messages and dispatches wake events.
 */

import type { Database as DatabaseType } from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { insertWakeEvent } from "../state/database.js";
import type {
  SupportedSocialChannel,
  SocialChannelConnector,
  IncomingMessage,
  SendMessageResult,
  ChannelStatus,
} from "./types.js";

const logger = createLogger("social.hub");

export interface SocialHubOptions {
  db?: DatabaseType;
  onWakeRequest?: (reason: string) => void;
}

export class SocialConnectorHub {
  private channels = new Map<SupportedSocialChannel, SocialChannelConnector>();
  private db?: DatabaseType;
  private onWakeRequest?: (reason: string) => void;
  private messageListeners: ((msg: IncomingMessage) => Promise<void>)[] = [];

  constructor(options?: SocialHubOptions) {
    this.db = options?.db;
    this.onWakeRequest = options?.onWakeRequest;
  }

  /**
   * Register a channel connector (Telegram, Zalo, Discord, etc.)
   */
  public registerChannel(connector: SocialChannelConnector): void {
    if (this.channels.has(connector.channelName)) {
      logger.warn(`Overwriting channel connector for ${connector.channelName}`);
    }
    this.channels.set(connector.channelName, connector);

    // Attach hub's inbound router to connector
    connector.onMessage(async (msg) => {
      await this.handleIncomingMessage(msg);
    });

    logger.info(`Channel connector registered: [${connector.channelName.toUpperCase()}]`);
  }

  public getChannel(channelName: SupportedSocialChannel): SocialChannelConnector | undefined {
    return this.channels.get(channelName);
  }

  /**
   * Initialize all registered channels
   */
  public async initAll(): Promise<void> {
    logger.info(`Initializing ${this.channels.size} social channels...`);
    for (const [name, connector] of this.channels.entries()) {
      try {
        await connector.init();
        logger.info(`Channel [${name.toUpperCase()}] initialized successfully.`);
      } catch (err: any) {
        logger.error(`Failed to initialize channel [${name.toUpperCase()}]: ${err?.message}`);
      }
    }
  }

  /**
   * Gracefully stop all registered channels
   */
  public async stopAll(): Promise<void> {
    logger.info("Stopping all social channels...");
    for (const [name, connector] of this.channels.entries()) {
      try {
        await connector.stop();
      } catch (err: any) {
        logger.warn(`Error stopping channel [${name}]: ${err?.message}`);
      }
    }
    logger.info("All social channels stopped.");
  }

  /**
   * Send an outgoing message through a specific channel
   */
  public async sendMessage(
    channel: SupportedSocialChannel,
    targetId: string,
    content: string,
    options?: { replyToId?: string },
  ): Promise<SendMessageResult> {
    const connector = this.channels.get(channel);
    if (!connector) {
      return {
        success: false,
        error: `Channel [${channel}] is not registered in SocialConnectorHub.`,
      };
    }
    return connector.sendMessage(targetId, content, options);
  }

  /**
   * Listen to all incoming messages across all channels
   */
  public onIncomingMessage(listener: (msg: IncomingMessage) => Promise<void>): void {
    this.messageListeners.push(listener);
  }

  /**
   * Central ingress handler for all incoming messages
   */
  private async handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    logger.info(
      `[INBOUND] Received from [${msg.channel.toUpperCase()}] ${msg.senderName} (${msg.senderId}): ${msg.content.slice(0, 80)}`,
    );

    // 1. Persist to SQLite inbox_messages table if db is provided
    if (this.db) {
      try {
        const fromAddress = `${msg.channel}:${msg.senderId}`;
        const formattedContent = `[${msg.channel.toUpperCase()} from ${msg.senderName}]: ${msg.content}`;

        this.db.prepare(
          `INSERT OR IGNORE INTO inbox_messages 
           (id, from_address, to_address, content, received_at, status, raw_content, reply_to)
           VALUES (?, ?, ?, ?, ?, 'received', ?, ?)`,
        ).run(
          msg.id,
          fromAddress,
          msg.chatId || "automaton",
          formattedContent,
          msg.timestamp || new Date().toISOString(),
          JSON.stringify(msg),
          msg.replyToId ?? null,
        );
      } catch (dbErr: any) {
        logger.error("Failed to persist incoming message to SQLite inbox_messages", dbErr);
      }

      // 2. Insert wake event so the ReAct loop wakes up to respond
      try {
        const reason = `${msg.channel.toUpperCase()} message from ${msg.senderName}: ${msg.content.slice(0, 50)}`;
        insertWakeEvent(this.db, "social", reason, {
          channel: msg.channel,
          senderId: msg.senderId,
          senderName: msg.senderName,
          chatId: msg.chatId,
          isCreator: msg.isCreator,
        });

        this.onWakeRequest?.(reason);
      } catch (wakeErr: any) {
        logger.warn(`Failed to insert wake event for incoming message: ${wakeErr?.message}`);
      }
    }

    // 3. Dispatch to any in-process listeners
    for (const listener of this.messageListeners) {
      try {
        await listener(msg);
      } catch (err: any) {
        logger.error("Error in hub message listener", err);
      }
    }
  }

  /**
   * Get connection status for all registered channels
   */
  public getStatuses(): ChannelStatus[] {
    const statuses: ChannelStatus[] = [];
    for (const connector of this.channels.values()) {
      statuses.push(connector.getStatus());
    }
    return statuses;
  }
}
