#!/usr/bin/env sh
set -e

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

if has_cmd pnpm; then
  PM="pnpm"
  INSTALL_CMD="pnpm add -g"
elif has_cmd npm; then
  PM="npm"
  INSTALL_CMD="npm i -g"
elif has_cmd bun; then
  PM="bun"
  INSTALL_CMD="bun add -g"
else
  echo "No supported package manager found (pnpm, npm, bun)." >&2
  exit 1
fi

echo "Using $PM to install global packages..."

$INSTALL_CMD @orbiter-finance/cli
$INSTALL_CMD @orbiter-finance/mcp-server

GLOBAL_ROOT=""
if [ "$PM" = "pnpm" ]; then
  GLOBAL_ROOT="$(pnpm root -g 2>/dev/null || true)"
elif [ "$PM" = "npm" ]; then
  GLOBAL_ROOT="$(npm root -g 2>/dev/null || true)"
elif [ "$PM" = "bun" ]; then
  GLOBAL_ROOT="$(bun pm cache dir 2>/dev/null || true)"
fi

echo ""
echo "Installed:"
echo "- @orbiter-finance/cli (binary: orbiter)"
echo "- @orbiter-finance/mcp-server"
echo ""
echo "MCP server entry (stdio):"
if [ -n "$GLOBAL_ROOT" ] && [ -f "$GLOBAL_ROOT/@orbiter-finance/mcp-server/dist/server.js" ]; then
  echo "node $GLOBAL_ROOT/@orbiter-finance/mcp-server/dist/server.js"
else
  echo "node <global_node_modules>/@orbiter-finance/mcp-server/dist/server.js"
fi

echo ""
echo "Next steps:"
echo "- Set ORBITER_API_BASE_URL and ORBITER_API_KEY if needed"
echo "- Configure your MCP client to run the command above"
