# Plugins

## Overview

Plugins extend Forge's build pipeline. They can transform files, inject globals, generate output, or hook into any build lifecycle event.

## Using plugins

Add plugins to the `plugins` array in `forge.config.ts`:

```ts
import { defineConfig } from "@forge/cli";
import { svgPlugin } from "@forge/plugin-svg";
import { wasmPlugin } from "@forge/plugin-wasm";

export default defineConfig({
  entry: "src/index.ts",
  plugins: [svgPlugin(), wasmPlugin({ inline: true })],
});
```

Plugins are applied in order. Each plugin receives the output of the previous one.

## Official plugins

| Package | Description |
|---------|-------------|
| `@forge/plugin-svg` | Import SVG files as React components or raw strings |
| `@forge/plugin-wasm` | Bundle WebAssembly modules |
| `@forge/plugin-css` | CSS modules and PostCSS support |
| `@forge/plugin-assets` | Copy and hash static assets |

## Writing a plugin

A Forge plugin is a function that returns a plugin object:

```ts
import type { ForgePlugin } from "@forge/cli";

export function myPlugin(options = {}): ForgePlugin {
  return {
    name: "my-plugin",

    // Transform a module's source code
    transform(code, id) {
      if (!id.endsWith(".txt")) return null;
      return `export default ${JSON.stringify(code)}`;
    },

    // Run logic after the build completes
    buildEnd(output) {
      console.log(`Built ${output.files.length} files`);
    },
  };
}
```

## Lifecycle hooks

| Hook | When it runs |
|------|-------------|
| `buildStart` | Before any modules are resolved |
| `resolve(id)` | When a module import is encountered |
| `load(id)` | When a module's source is read |
| `transform(code, id)` | After a module is loaded |
| `buildEnd(output)` | After all chunks are written |

## Plugin ordering

Plugins run in the order they are listed. If two plugins transform the same file type, the last one wins unless a plugin explicitly calls `next()` to pass control down the chain.
