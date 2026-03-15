# Configuration

## forge.config.ts

Forge is configured via a `forge.config.ts` file at the project root. All fields are optional unless noted.

```ts
import { defineConfig } from "@forge/cli";

export default defineConfig({
  entry: "src/index.ts",      // required: build entry point
  outDir: "dist",             // default: "dist"
  target: "node22",           // default: "node18"
  format: "esm",              // "esm" | "cjs" | "iife"
  sourcemap: true,
  minify: false,
  plugins: [],
});
```

## Entry points

`entry` accepts a single path or an array for multiple outputs:

```ts
entry: ["src/cli.ts", "src/lib.ts"]
```

Each entry produces a separate bundle in `outDir`.

## Targets

The `target` field controls which JS syntax features are downleveled. Common values:

| Value | Min Node |
|-------|----------|
| `node18` | 18.x |
| `node20` | 20.x |
| `node22` | 22.x |
| `browser` | evergreen |

## Output formats

- `esm` — ES modules with `import`/`export` (default)
- `cjs` — CommonJS with `require`/`module.exports`
- `iife` — Self-executing bundle for `<script>` tags

## Environment variables

Forge reads `.env`, `.env.local`, and `.env.<NODE_ENV>` files at build time. Variables prefixed with `PUBLIC_` are inlined into the bundle; all others are stripped.

## Extending with plugins

```ts
import { defineConfig } from "@forge/cli";
import { svgPlugin } from "@forge/plugin-svg";

export default defineConfig({
  entry: "src/index.ts",
  plugins: [svgPlugin()],
});
```

See [Plugins](plugins.md) for the full plugin API.
