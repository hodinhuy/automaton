/**
 * Browser Engine Types & Contracts
 */

export type BrowserActionType =
  | "navigate"
  | "screenshot"
  | "extract"
  | "click"
  | "type"
  | "ai_task";

export interface BrowserActionRequest {
  action?: BrowserActionType;
  url?: string;
  task?: string;
  selector?: string;
  text?: string;
  headless?: boolean;
  timeoutSeconds?: number;
}

export interface BrowserActionResponse {
  success: boolean;
  url?: string;
  title?: string;
  content?: string;
  screenshotBase64?: string;
  screenshotPath?: string;
  error?: string;
}

export interface BrowserClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  autoSpawn?: boolean;
}
