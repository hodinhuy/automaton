import { createBuiltinTools } from "../src/agent/tools.js";

async function main() {
  console.log("=== Testing Automaton ReAct Tool: browser_action ===");
  const tools = createBuiltinTools("test-sandbox");
  const browserTool = tools.find((t) => t.name === "browser_action");

  if (!browserTool) {
    console.error("Tool browser_action not found!");
    process.exit(1);
  }

  console.log("Calling tool browser_action with { action: 'extract', url: 'https://news.ycombinator.com' }...");
  const result = await browserTool.execute(
    {
      action: "extract",
      url: "https://news.ycombinator.com",
    },
    {} as any,
  );

  console.log("\n--- TOOL EXECUTION OUTPUT ---");
  console.log(result.slice(0, 500) + "...");
}

main().catch(console.error);
