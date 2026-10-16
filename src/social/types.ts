/**
 * Social Omnichannel Types
 *
 * Defines the unified data contracts for all social communication channels
 * (Telegram, Zalo, Discord, Facebook, Web, etc.) based on
 * docs/OMNICHANNEL_SOCIAL_ARCHITECTURE.md
 */

export type SupportedSocialChannel =
  | "telegram"
  | "zalo"
  | "discord"
  | "facebook"
  | "web";

export type ThreadType = "direct" | "group";

export interface IncomingMessage {
  id: string;
  channel: SupportedSocialChannel;
  senderId: string;
  senderName: string;
  senderUsername?: string;
  chatId: string;
  isCreator: boolean;
  content: string;
  threadType: ThreadType;
  timestamp: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  reply?: (text: string) => Promise<SendMessageResult>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelStatus {
  connected: boolean;
  channel: SupportedSocialChannel;
  mode?: string;
  details?: Record<string, unknown>;
}

export interface SocialChannelConnector {
  readonly channelName: SupportedSocialChannel;
  init(): Promise<void>;
  sendMessage(
    targetId: string,
    content: string,
    options?: { replyToId?: string },
  ): Promise<SendMessageResult>;
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;
  stop(): Promise<void>;
  getStatus(): ChannelStatus;
}

export interface TelegramChannelConfig {
  enabled: boolean;
  mode: "bot" | "userbot";
  botToken?: string;
  apiId?: number;
  apiHash?: string;
  sessionString?: string;
  phoneNumber?: string;
  creatorTelegramId?: string | number;
  allowedChatIds?: (string | number)[];
  typingDelayMs?: number;
}
