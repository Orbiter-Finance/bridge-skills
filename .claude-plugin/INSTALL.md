# Claude Installation

This repository provides an MCP server and skills docs for Orbiter Finance.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Orbiter-Finance/bridge-skills/main/install.sh | sh
```

## Manual Install

```bash
npm i -g @orbiter-finance/cli @orbiter-finance/mcp-server
```

## MCP Server (stdio)

Use this command in your MCP client configuration:

```bash
node <global_node_modules>/@orbiter-finance/mcp-server/dist/server.js
```

## Environment Variables
- `ORBITER_API_BASE_URL` (optional, default `https://openapi.orbiter.finance`)
- `ORBITER_API_KEY` (optional)

## Skills Docs

Skills live under `skills/` and describe tool inputs/outputs and examples.
