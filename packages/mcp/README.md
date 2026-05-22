# @nightwatcher314/agentmemory-mcp

Standalone MCP server for [agentmemory](https://github.com/NightWatcher314/agentmemory).

This is a thin shim package that re-exposes the standalone MCP entrypoint from
[`@nightwatcher314/agentmemory`](https://www.npmjs.com/package/@nightwatcher314/agentmemory),
so MCP client configs that say `npx @nightwatcher314/agentmemory-mcp` work out of the box
without installing the full package first.

## Usage

```bash
npx -y @nightwatcher314/agentmemory-mcp
```

Or wire it into your MCP client (Claude Desktop, OpenClaw, Cursor, Codex, etc.):

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["-y", "@nightwatcher314/agentmemory-mcp"]
    }
  }
}
```

This package depends on `@nightwatcher314/agentmemory` and forwards to its
`dist/standalone.mjs` entrypoint. If you already have `@nightwatcher314/agentmemory`
installed, you can call the same entrypoint directly:

```bash
npx @nightwatcher314/agentmemory mcp
```

Both commands do the same thing.

## Why does this package exist?

The upstream package uses a scoped shim because npm's name-similarity policy
blocks the unscoped `agentmemory-mcp` name. This fork follows the same shape
under the `@nightwatcher314` scope so MCP clients can depend on a dedicated
standalone package without installing the full package first.

## License

Apache-2.0
