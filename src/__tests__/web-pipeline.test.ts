import { describe, it, expect } from "vitest";
import { searchWeb, extractWeb } from "../agent/web-tools.js";
import { createBuiltinTools } from "../agent/tools.js";
import { buildSystemPrompt } from "../agent/system-prompt.js";
import { createTestDb, createTestIdentity, createTestConfig } from "./mocks.js";

describe("3-Tier Web Pipeline", () => {
  it("registers web_search, web_extract, and browser_action in builtin tools", () => {
    const tools = createBuiltinTools();

    const searchTool = tools.find((t) => t.name === "web_search");
    const extractTool = tools.find((t) => t.name === "web_extract");
    const browserTool = tools.find((t) => t.name === "browser_action");

    expect(searchTool).toBeDefined();
    expect(searchTool?.category).toBe("browser");
    expect(searchTool?.riskLevel).toBe("safe");

    expect(extractTool).toBeDefined();
    expect(extractTool?.category).toBe("browser");
    expect(extractTool?.riskLevel).toBe("safe");

    expect(browserTool).toBeDefined();
    expect(browserTool?.category).toBe("browser");
  });

  it("includes 3-Tier Web Pipeline Routing in system prompt", () => {
    const db = createTestDb();
    const identity = createTestIdentity();
    const config = createTestConfig();
    const tools = createBuiltinTools();

    const prompt = buildSystemPrompt({
      config,
      identity,
      financial: { creditsCents: 5000, usdcBalance: 10, lastChecked: new Date().toISOString() },
      state: "running" as any,
      db,
      tools,
      isFirstRun: false,
    });

    expect(prompt).toContain("WEB RESEARCH & 3-TIER WEB PIPELINE GUIDELINES");
    expect(prompt).toContain('Step 1: DISCOVER ("web_search")');
    expect(prompt).toContain('Step 2: READ DEEP ("web_extract")');
    expect(prompt).toContain('Step 3: ESCALATE ("browser_action")');
  });

  it("executes searchWeb and returns structured results", async () => {
    const results = await searchWeb("TypeScript programming language", 3);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("url");
    expect(results[0]).toHaveProperty("snippet");
  }, 15000);

  it("extracts clean markdown and removes clutter tags via extractWeb", async () => {
    const res = await extractWeb("https://en.wikipedia.org/wiki/TypeScript", 4000);
    expect(res.url).toBe("https://en.wikipedia.org/wiki/TypeScript");
    expect(res.title).toBeDefined();
    expect(res.content).toBeDefined();
    expect(res.content).not.toContain("<script>");
    expect(res.content).not.toContain("<style>");
  }, 15000);
});
