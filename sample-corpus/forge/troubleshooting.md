# Troubleshooting

## Build fails with "Cannot find entry"

Forge could not locate the file specified in `entry`. Check that:

- The path is relative to the project root, not `forge.config.ts`
- The file extension is included (`.ts`, `.js`, etc.)
- The file exists and is not excluded by `.forgeignore`

## Output is larger than expected

Run `forge build --analyze` to open a bundle size visualizer. Common causes:

- A large dependency is not being tree-shaken because it uses CommonJS exports
- An asset (image, font) is being inlined instead of referenced
- `minify` is set to `false`

Convert CJS dependencies with `@forge/plugin-cjs-interop` if tree-shaking is blocked.

## Watch mode misses changes

`forge dev` uses filesystem events. On Linux, the default inotify watch limit can be too low:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

On macOS, no action is needed — Forge uses FSEvents.

## TypeScript errors not caught at build time

Forge transpiles TypeScript without type-checking for speed. To catch type errors, run `tsc --noEmit` separately or add it to your CI pipeline:

```bash
tsc --noEmit && forge build
```

## Plugin transform not applied

Check the plugin order in your config. If two plugins handle the same file type, only the last one's `transform` runs unless the earlier plugin explicitly delegates with `next()`. Move the plugin earlier in the array to give it priority.

## Environment variable not available at runtime

Only variables prefixed with `PUBLIC_` are inlined. Double-check the prefix and restart `forge dev` after changing `.env` files — Forge does not hot-reload env files during a running watch session.
