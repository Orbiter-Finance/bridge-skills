# Release

## Build

```bash
pnpm -C . install
pnpm -C . run build
```

## Pack (optional)

```bash
pnpm -C cli pack
pnpm -C mcp pack
pnpm -C packages/orbiter-api pack
```

## Publish

```bash
pnpm -C cli publish --access public
pnpm -C mcp publish --access public
pnpm -C packages/orbiter-api publish --access public
```

## Version

Update each package `version` before publishing:
- `cli/package.json`
- `mcp/package.json`
- `packages/orbiter-api/package.json`
