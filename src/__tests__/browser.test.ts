import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrowserClient } from "../browser/client.js";
import { createBuiltinTools } from "../agent/tools.js";

describe("BrowserClient and Tool Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers browser_action in createBuiltinTools with valid parameters", () => {
    const tools = createBuiltinTools("test-sandbox");
    const browserTool = tools.find((t) => t.name === "browser_action");

    expect(browserTool).toBeDefined();
    expect(browserTool?.category).toBe("browser");
    expect(browserTool?.parameters.properties).toHaveProperty("action");
    expect(browserTool?.parameters.properties).toHaveProperty("url");
    expect(browserTool?.parameters.properties).toHaveProperty("task");
  });

  it("reports unavailable when server is offline and autoSpawn is disabled", async () => {
    const client = new BrowserClient({
      baseUrl: "http://127.0.0.1:99999",
      autoSpawn: false,
    });

    const available = await client.isAvailable();
    expect(available).toBe(false);

    const result = await client.execute({
      action: "navigate",
      url: "https://example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("offline");
  });

  it("executes browser action when server responds with success", async () => {
    const client = new BrowserClient({
      baseUrl: "http://127.0.0.1:8765",
      autoSpawn: false,
    });

    vi.spyOn(client, "isAvailable").mockResolvedValue(true);

    const mockResponse = {
      success: true,
      url: "https://example.com",
      title: "Example Domain",
      content: "This domain is for use in illustrative examples.",
      screenshotPath: "/root/.automaton/screenshots/example.png",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await client.execute({
      action: "navigate",
      url: "https://example.com",
    });

    expect(result.success).toBe(true);
    expect(result.title).toBe("Example Domain");
    expect(result.content).toContain("illustrative examples");
  });

  it("handles HTTP failure from browser service gracefully", async () => {
    const client = new BrowserClient({
      baseUrl: "http://127.0.0.1:8765",
      autoSpawn: false,
    });

    vi.spyOn(client, "isAvailable").mockResolvedValue(true);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Chromium crash",
    } as any);

    const result = await client.execute({
      action: "screenshot",
      url: "https://bad-site.invalid",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 500");
  });
});
