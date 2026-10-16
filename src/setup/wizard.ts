import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { AutomatonConfig, TreasuryPolicy } from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";
import { getWallet, getAutomatonDir } from "../identity/wallet.js";
import { createConfig, saveConfig } from "../config.js";
import { writeDefaultHeartbeatConfig } from "../heartbeat/config.js";
import { showBanner } from "./banner.js";
import {
  promptRequired,
  promptMultiline,
  promptAddress,
  promptOptional,
  promptWithDefault,
  promptYesNo,
  promptChoice,
  closePrompts,
} from "./prompts.js";
import { detectEnvironment } from "./environment.js";
import { generateSoulMd, installDefaultSkills } from "./defaults.js";
import type { ChainType } from "../identity/chain.js";

export async function runSetupWizard(): Promise<AutomatonConfig> {
  showBanner();

  console.log(chalk.white("  First-run setup. Let's bring your automaton to life.\n"));

  // ─── 1. Chain selection + wallet ──────────────────────────────
  console.log(chalk.cyan("  [1/7] Chain selection & identity (wallet)..."));
  let selectedChain: ChainType = "evm";
  const chainInput = await promptOptional("Chain type (evm or solana) [evm]");
  if (chainInput && chainInput.toLowerCase() === "solana") {
    selectedChain = "solana";
    console.log(chalk.green("  Chain: Solana (Ed25519)\n"));
  } else {
    console.log(chalk.green("  Chain: EVM (secp256k1)\n"));
  }

  const { account, chainIdentity, chainType: walletChainType, isNew } = await getWallet(selectedChain);
  const walletAddress = chainIdentity.address;
  if (isNew) {
    console.log(chalk.green(`  Wallet created: ${walletAddress}`));
  } else {
    console.log(chalk.green(`  Wallet loaded: ${walletAddress}`));
  }
  console.log(chalk.dim(`  Private key stored at: ${getAutomatonDir()}/wallet.json\n`));

  // ─── 2. Configure AI Model & Inference Provider ──────────────
  console.log(chalk.cyan("  [2/7] AI Model & Inference Provider configuration..."));
  const envOpenAiKey = process.env.OPENAI_API_KEY || "";
  const defaultGateway = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  const openaiApiKeyInput = await promptOptional(
    envOpenAiKey ? `OpenAI / OpenRouter API key [Found in env]` : "OpenAI / OpenRouter API key (sk-...)"
  );
  const openaiApiKey = openaiApiKeyInput || envOpenAiKey || undefined;
  if (openaiApiKey) {
    console.log(chalk.green("  API key saved."));
  } else {
    console.log(chalk.yellow("  No API key provided yet. You can set it later via --configure or OPENAI_API_KEY."));
  }

  const defaultModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const modelInput = await promptOptional(`Inference Model name [${defaultModel}]`);
  const inferenceModel = modelInput || defaultModel;
  console.log(chalk.green(`  Model: ${inferenceModel}`));

  const openaiBaseUrlInput = await promptOptional(
    `Gateway Base URL (e.g. https://openrouter.ai/api/v1) [${defaultGateway}]`
  );
  const openaiBaseUrl = openaiBaseUrlInput || defaultGateway;
  if (openaiBaseUrl !== "https://api.openai.com/v1") {
    console.log(chalk.green(`  Gateway Base URL: ${openaiBaseUrl}`));
  }

  const anthropicApiKey = await promptOptional("Anthropic API key (sk-ant-..., optional)");
  if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-")) {
    console.log(chalk.yellow("  Warning: Anthropic keys usually start with sk-ant-. Saving anyway."));
  }

  const ollamaInput = await promptOptional("Ollama base URL (http://localhost:11434, optional)");
  const ollamaBaseUrl = ollamaInput || undefined;
  if (ollamaBaseUrl) {
    console.log(chalk.green(`  Ollama URL saved: ${ollamaBaseUrl}`));
  }
  console.log();

  const apiKey = openaiApiKey || anthropicApiKey || "local-employee-key";

  // ─── 3. Interactive questions ─────────────────────────────────
  console.log(chalk.cyan("  [3/7] Employee Profile & Creator\n"));

  const name = await promptRequired("What do you want to name your digital teammate?");
  console.log(chalk.green(`  Name: ${name}\n`));

  const genesisPrompt = await promptMultiline("Enter the genesis prompt (role, instructions, personality) for your teammate.");
  console.log(chalk.green(`  Genesis prompt set (${genesisPrompt.length} chars)\n`));

  console.log(chalk.dim(`  Your teammate's cashier wallet is ${walletAddress}`));
  console.log(chalk.dim("  Enter YOUR wallet address (the human creator/manager to receive payouts/tips).\n"));
  const creatorAddressLabel = walletChainType === "solana"
    ? "Creator wallet address (base58)"
    : "Creator wallet address (0x...)";
  const creatorAddress = await promptAddress(creatorAddressLabel, walletChainType);
  console.log(chalk.green(`  Creator: ${creatorAddress}\n`));

  // ─── Financial Safety Policy ─────────────────────────────────
  console.log(chalk.cyan("  Financial Safety Policy"));
  console.log(chalk.dim("  These limits protect against unauthorized spending. Press Enter for defaults.\n"));

  const treasuryPolicy: TreasuryPolicy = {
    maxSingleTransferCents: await promptWithDefault(
      "Max single transfer (cents)", DEFAULT_TREASURY_POLICY.maxSingleTransferCents),
    maxHourlyTransferCents: await promptWithDefault(
      "Max hourly transfers (cents)", DEFAULT_TREASURY_POLICY.maxHourlyTransferCents),
    maxDailyTransferCents: await promptWithDefault(
      "Max daily transfers (cents)", DEFAULT_TREASURY_POLICY.maxDailyTransferCents),
    minimumReserveCents: await promptWithDefault(
      "Minimum reserve (cents)", DEFAULT_TREASURY_POLICY.minimumReserveCents),
    maxX402PaymentCents: await promptWithDefault(
      "Max x402 payment (cents)", DEFAULT_TREASURY_POLICY.maxX402PaymentCents),
    x402AllowedDomains: DEFAULT_TREASURY_POLICY.x402AllowedDomains,
    transferCooldownMs: DEFAULT_TREASURY_POLICY.transferCooldownMs,
    maxTransfersPerTurn: DEFAULT_TREASURY_POLICY.maxTransfersPerTurn,
    maxInferenceDailyCents: await promptWithDefault(
      "Max daily inference spend (cents)", DEFAULT_TREASURY_POLICY.maxInferenceDailyCents),
    requireConfirmationAboveCents: await promptWithDefault(
      "Require confirmation above (cents)", DEFAULT_TREASURY_POLICY.requireConfirmationAboveCents),
  };

  console.log(chalk.green("  Treasury policy configured.\n"));

  // ─── 4. Communication Channels (Omnichannel) ─────────────────
  console.log(chalk.cyan("  [4/7] Communication Channels (Omnichannel Setup)\n"));
  console.log(chalk.dim("  Connect your digital employee to messaging channels (Telegram, Zalo, Discord).\n"));

  let telegramConfig: import("../social/types.js").TelegramChannelConfig | undefined;
  const enableTelegram = await promptYesNo("Enable Telegram channel?", true);

  if (enableTelegram) {
    console.log(chalk.white("\n  Select Telegram connection mode:"));
    console.log(chalk.dim("    • 'bot'     : Official Bot API Token (from @BotFather) [Recommended for quick start]"));
    console.log(chalk.dim("    • 'userbot' : Real User Account via MTProto (GramJS) [Acts as a human employee]\n"));

    const mode = await promptChoice("Telegram mode", ["bot", "userbot"] as const, "bot");

    if (mode === "bot") {
      const tokenInput = await promptOptional("Telegram Bot Token (from @BotFather, press Enter to set in .env later)");
      const creatorIdInput = await promptOptional("Your Telegram User ID (optional, to identify you as Admin/Creator)");

      telegramConfig = {
        enabled: true,
        mode: "bot",
        botToken: tokenInput || undefined,
        creatorTelegramId: creatorIdInput || undefined,
      };

      if (tokenInput) {
        console.log(chalk.green("  Telegram Bot configured."));
      } else {
        console.log(chalk.yellow("  No Bot Token provided yet. You can set TELEGRAM_BOT_TOKEN in .env anytime."));
      }
    } else {
      console.log(chalk.dim("\n  Userbot requires TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION_STRING."));
      console.log(chalk.dim("  (Obtain API ID & Hash from https://my.telegram.org)\n"));

      const apiIdInput = await promptOptional("Telegram API ID (optional, press Enter to set later)");
      const apiHashInput = await promptOptional("Telegram API Hash (optional)");
      const sessionInput = await promptOptional("Telegram Session String (optional)");
      const creatorIdInput = await promptOptional("Your Telegram User ID (optional)");

      telegramConfig = {
        enabled: true,
        mode: "userbot",
        apiId: apiIdInput ? Number(apiIdInput) : undefined,
        apiHash: apiHashInput || undefined,
        sessionString: sessionInput || undefined,
        creatorTelegramId: creatorIdInput || undefined,
      };

      if (!sessionInput) {
        console.log(chalk.yellow("  Tip: Run 'pnpm tsx scripts/login-telegram.ts' after setup to generate your Session String."));
      } else {
        console.log(chalk.green("  Telegram Userbot session saved."));
      }
    }
  } else {
    console.log(chalk.dim("  Telegram channel skipped."));
  }

  console.log(chalk.dim("  (Note: Zalo, Discord, and Browser Agent channels can be added in subsequent updates)\n"));

  // ─── 5. Detect environment ────────────────────────────────────
  console.log(chalk.cyan("  [5/7] Detecting environment..."));
  const env = detectEnvironment();
  if (env.sandboxId) {
    console.log(chalk.green(`  Conway sandbox detected: ${env.sandboxId}\n`));
  } else {
    console.log(chalk.dim(`  Environment: ${env.type} (no sandbox detected)\n`));
  }

  // ─── 6. Write config + heartbeat + SOUL.md + skills ───────────
  console.log(chalk.cyan("  [6/7] Writing configuration..."));

  const config = createConfig({
    name,
    genesisPrompt,
    creatorAddress,
    registeredWithConway: !!apiKey,
    sandboxId: env.sandboxId,
    walletAddress,
    apiKey,
    openaiBaseUrl: openaiBaseUrl || undefined,
    openaiApiKey: openaiApiKey || undefined,
    inferenceModel,
    anthropicApiKey: anthropicApiKey || undefined,
    ollamaBaseUrl,
    treasuryPolicy,
    chainType: walletChainType,
    telegram: telegramConfig,
  });

  saveConfig(config);
  console.log(chalk.green("  automaton.json written"));

  writeDefaultHeartbeatConfig();
  console.log(chalk.green("  heartbeat.yml written"));

  // constitution.md (immutable — copied from repo, protected from self-modification)
  const automatonDir = getAutomatonDir();
  const constitutionSrc = path.join(process.cwd(), "constitution.md");
  const constitutionDst = path.join(automatonDir, "constitution.md");
  if (fs.existsSync(constitutionSrc)) {
    if (fs.existsSync(constitutionDst)) {
      try {
        fs.chmodSync(constitutionDst, 0o666);
      } catch {}
    }
    fs.copyFileSync(constitutionSrc, constitutionDst);
    try {
      fs.chmodSync(constitutionDst, 0o444); // read-only
    } catch {}
    console.log(chalk.green("  constitution.md installed (read-only)"));
  }

  // SOUL.md
  const soulPath = path.join(automatonDir, "SOUL.md");
  if (fs.existsSync(soulPath)) {
    try {
      fs.chmodSync(soulPath, 0o666);
    } catch {}
  }
  fs.writeFileSync(soulPath, generateSoulMd(name, walletAddress, creatorAddress, genesisPrompt), { mode: 0o600 });
  console.log(chalk.green("  SOUL.md written"));

  // Default skills
  const skillsDir = config.skillsDir || "~/.automaton/skills";
  installDefaultSkills(skillsDir);
  console.log(chalk.green("  Default skills installed (conway-compute, conway-payments, survival)\n"));

  // ─── 7. Funding guidance ──────────────────────────────────────
  console.log(chalk.cyan("  [7/7] Funding\n"));
  showFundingPanel(walletAddress, walletChainType);

  closePrompts();

  return config;
}

function showFundingPanel(address: string, chainType: ChainType = "evm"): void {
  const short = `${address.slice(0, 6)}...${address.slice(-5)}`;
  const usdcNetwork = chainType === "solana" ? "Solana" : "Base";
  const w = 58;
  const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - s.length));

  console.log(chalk.cyan(`  ${"╭" + "─".repeat(w) + "╮"}`));
  console.log(chalk.cyan(`  │${pad("  Fund your automaton", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad(`  Address: ${short}`, w)}│`));
  console.log(chalk.cyan(`  │${pad(`  Chain: ${chainType === "solana" ? "Solana" : "EVM (Base)"}`, w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  1. Transfer Conway credits", w)}│`));
  console.log(chalk.cyan(`  │${pad("     conway credits transfer <address> <amount>", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad(`  2. Send USDC on ${usdcNetwork} to the address above`, w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  3. Fund via Conway Cloud dashboard", w)}│`));
  console.log(chalk.cyan(`  │${pad("     https://app.conway.tech", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  The automaton will start now. Fund it anytime —", w)}│`));
  console.log(chalk.cyan(`  │${pad("  the survival system handles zero-credit gracefully.", w)}│`));
  console.log(chalk.cyan(`  ${"╰" + "─".repeat(w) + "╯"}`));
  console.log("");
}
