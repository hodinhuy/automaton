/**
 * Agent Runtime Client
 *
 * Provides execution, file I/O, and sandbox management by interfacing
 * with the underlying AgentRuntimeDriver (Docker container or Local process).
 */

import type {
  ConwayClient,
  ExecResult,
  PortInfo,
  CreateSandboxOptions,
  SandboxInfo,
  PricingTier,
  CreditTransferResult,
  DomainSearchResult,
  DomainRegistration,
  DnsRecord,
  ModelInfo,
} from "../types.js";
import { LocalProcessDriver } from "./local-driver.js";
import type { AgentRuntimeDriver } from "./types.js";
import { ulid } from "ulid";
import type { PrivateKeyAccount } from "viem";
import type { ChainType, ChainIdentity } from "../identity/chain.js";

export interface RuntimeClientOptions {
  apiUrl?: string;
  apiKey?: string;
  sandboxId?: string;
  runtimeDriver?: AgentRuntimeDriver;
}

export type AgentRuntimeClient = ConwayClient;

export function createRuntimeClient(options: RuntimeClientOptions = {}): AgentRuntimeClient {
  const sandboxId = normalizeSandboxId(options.sandboxId);
  const driver = options.runtimeDriver || new LocalProcessDriver();

  const exec = async (
    command: string,
    timeout?: number,
  ): Promise<ExecResult> => {
    return driver.exec(command, { timeoutMs: timeout, sandboxId });
  };

  const writeFile = async (
    filePath: string,
    content: string,
  ): Promise<void> => {
    return driver.writeFile(filePath, content, sandboxId);
  };

  const readFile = async (filePath: string): Promise<string> => {
    return driver.readFile(filePath, sandboxId);
  };

  const exposePort = async (port: number): Promise<PortInfo> => {
    return driver.exposePort(port);
  };

  const removePort = async (port: number): Promise<void> => {
    return driver.removePort(port);
  };

  // ─── Sandbox Management (Sub-agents) ─────────────────────────

  const createSandbox = async (
    sandboxOpts: CreateSandboxOptions,
  ): Promise<SandboxInfo> => {
    return driver.createSandbox(sandboxOpts);
  };

  const deleteSandbox = async (targetId: string): Promise<void> => {
    return driver.deleteSandbox(targetId);
  };

  const listSandboxes = async (): Promise<SandboxInfo[]> => {
    return driver.listSandboxes();
  };

  // ─── Self-hosted Operating Budget ────────────────────────────

  const getCreditsBalance = async (): Promise<number> => {
    return 10000; // $100 default budget
  };

  const getCreditsPricing = async (): Promise<PricingTier[]> => {
    return [];
  };

  const transferCredits = async (
    toAddress: string,
    amountCents: number,
    _note?: string,
  ): Promise<CreditTransferResult> => {
    return {
      transferId: ulid(),
      status: "completed",
      toAddress,
      amountCents,
      balanceAfterCents: 10000,
    };
  };

  const registerAutomaton = async (params: {
    automatonId: string;
    automatonAddress: string;
    creatorAddress: string;
    name: string;
    bio?: string;
    genesisPromptHash?: `0x${string}`;
    account: PrivateKeyAccount;
    nonce?: string;
    chainType?: ChainType;
    chainIdentity?: ChainIdentity;
  }): Promise<{ automaton: Record<string, unknown> }> => {
    return {
      automaton: {
        id: params.automatonId,
        automaton_address: params.automatonAddress,
        creator_address: params.creatorAddress,
        name: params.name,
        status: "registered",
      },
    };
  };

  const searchDomains = async (
    _query: string,
    _tlds?: string,
  ): Promise<DomainSearchResult[]> => {
    return [];
  };

  const registerDomain = async (
    domain: string,
    _years: number = 1,
  ): Promise<DomainRegistration> => {
    return {
      domain,
      status: "registered",
      expiresAt: new Date(Date.now() + 31536000000).toISOString(),
      transactionId: ulid(),
    };
  };

  const listDnsRecords = async (_domain: string): Promise<DnsRecord[]> => {
    return [];
  };

  const addDnsRecord = async (
    _domain: string,
    type: string,
    host: string,
    value: string,
    ttl?: number,
  ): Promise<DnsRecord> => {
    return {
      id: ulid(),
      type,
      host,
      value,
      ttl: ttl || 3600,
    };
  };

  const deleteDnsRecord = async (
    _domain: string,
    _recordId: string,
  ): Promise<void> => {
    return;
  };

  const listModels = async (): Promise<ModelInfo[]> => {
    return [];
  };

  const createScopedClient = (targetSandboxId: string): AgentRuntimeClient => {
    return createRuntimeClient({ sandboxId: targetSandboxId, runtimeDriver: driver });
  };

  return {
    isLocal: driver.type === "local",
    exec,
    writeFile,
    readFile,
    exposePort,
    removePort,
    createSandbox,
    deleteSandbox,
    listSandboxes,
    getCreditsBalance,
    getCreditsPricing,
    transferCredits,
    registerAutomaton,
    searchDomains,
    registerDomain,
    listDnsRecords,
    addDnsRecord,
    deleteDnsRecord,
    listModels,
    createScopedClient,
  };
}

// Backward-compatibility alias
export const createConwayClient = createRuntimeClient;

function normalizeSandboxId(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (trimmed === "undefined" || trimmed === "null") return "";
  return trimmed;
}
