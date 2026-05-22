#!/usr/bin/env node
import("@nightwatcher314/agentmemory/dist/standalone.mjs").catch((err) => {
  console.error(
    "[@nightwatcher314/agentmemory-mcp] Failed to load standalone entrypoint from @nightwatcher314/agentmemory.",
  );
  console.error(
    "[@nightwatcher314/agentmemory-mcp] Try installing manually: npm i -g @nightwatcher314/agentmemory",
  );
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
