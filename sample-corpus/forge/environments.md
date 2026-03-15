# Environments

## Overview

Forge supports first-class environment management so you can maintain separate configurations for development, staging, and production without duplicating your build setup.

## .env files

Forge loads environment files in this order (later files take precedence):

1. `.env`
2. `.env.local`
3. `.env.<NODE_ENV>` (e.g. `.env.production`)
4. `.env.<NODE_ENV>.local`

`.local` files are gitignored by default.

## Variable visibility

Only variables prefixed with `PUBLIC_` are inlined into the bundle and visible at runtime:

```
PUBLIC_API_URL=https://api.example.com   # inlined
DATABASE_URL=postgres://...              # build-time only, stripped from output
```

Access inlined variables via `import.meta.env`:

```ts
const url = import.meta.env.PUBLIC_API_URL;
```

## Per-environment config

Use the `env` callback in `forge.config.ts` to vary build settings per environment:

```ts
import { defineConfig } from "@forge/cli";

export default defineConfig(({ env }) => ({
  entry: "src/index.ts",
  minify: env === "production",
  sourcemap: env !== "production",
}));
```

The `env` value is taken from `NODE_ENV` at build time.

## Switching environments

```bash
NODE_ENV=production forge build
NODE_ENV=staging forge build
forge dev  # NODE_ENV defaults to "development"
```

## Secrets management

Never commit secrets in `.env` files. For CI/CD, inject secrets via your pipeline's secret store and reference them as environment variables. Forge will pick them up automatically.
