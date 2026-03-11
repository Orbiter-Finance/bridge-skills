import { readFile, writeFile } from "node:fs/promises";

const filePath = process.argv[2];
if (!filePath) {
  throw new Error("Missing file path");
}

const content = await readFile(filePath, "utf8");
if (content.startsWith("#!/usr/bin/env node")) {
  process.exit(0);
}

await writeFile(filePath, `#!/usr/bin/env node\n${content}`, "utf8");
