import { readFile, writeFile } from "node:fs/promises";

const [target] = process.argv.slice(2);
if (!target) {
  console.error("Usage: add-shebang.mjs <file>");
  process.exit(1);
}

const content = await readFile(target, "utf8");
if (content.startsWith("#!/usr/bin/env node")) {
  process.exit(0);
}

await writeFile(target, `#!/usr/bin/env node\n${content}`);
