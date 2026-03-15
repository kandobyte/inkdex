# Quickstart

## Prerequisites

- Node.js 18 or later
- A `forge.config.ts` file in your project root

## Installation

Install Forge globally or as a dev dependency:

```bash
npm install -g @forge/cli
# or per-project
npm install --save-dev @forge/cli
```

## Your first build

Create a minimal config:

```ts
// forge.config.ts
import { defineConfig } from "@forge/cli";

export default defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
});
```

Run the build:

```bash
forge build
```

Output is written to `dist/`. Forge automatically tree-shakes unused exports and minifies production output.

## Watch mode

Run `forge dev` to start an incremental watcher. Forge rebuilds only the modules that changed and streams logs to the terminal.

```bash
forge dev
```

## Next steps

- See [Configuration](configuration.md) for all config options
- See [Plugins](plugins.md) to extend the build pipeline
- See [Environments](environments.md) to manage dev/staging/prod differences
