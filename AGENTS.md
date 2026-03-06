# AGENTS.md

## Project Overview

`@chelonia/serdes` — A TypeScript library for serializing and deserializing complex JavaScript objects that neither `structuredClone` nor `JSON` support natively. It enables sharing custom objects (including functions, `Map`, `Set`, `Error`, `Blob`, `File`, `ArrayBuffer`, `MessagePort`, etc.) across `MessagePort` boundaries.

Published under the `@chelonia` npm scope by okTurtles Foundation.

## Commands

| Task | Command |
|------|---------|
| **Install** | `npm install` (or `npm ci` in CI) |
| **Test** | `npm test` (runs lint first, then tests with `--expose-gc`) |
| **Lint** | `npm run lint` |
| **Build (all)** | `npm run build` |
| **Build ESM** | `npm run build:esm` |
| **Build UMD** | `npm run build:umd` |
| **Clean** | `npm run clean` |

### Notes on `npm test`

- The test script runs `npm run lint` **then** executes the test file via `ts-node/esm` with `--expose-gc`.
- `--expose-gc` is required so the `gc()` call in the `afterEach` hook works (prevents tests from hanging while waiting for garbage collection).
- Tests use Node.js built-in test runner (`node:test`) and `node:assert/strict` — no external test framework.
- Node 22 is used in CI.

## Code Organization

```
src/
  index.ts          # All library code (serializer, deserializer, symbols)
  index.test.ts     # All tests
dist/
  esm/              # ESM build output (.js, .d.mts)
  umd/              # UMD build output (.cjs, .d.cts)
```

This is a single-file library. All exports live in `src/index.ts`. Tests are in a single file `src/index.test.ts`.

## Dual Package Build

The library ships both ESM and UMD formats via two separate TypeScript configs:

- `tsconfig.json` → ESM build → `dist/esm/` (module: `NodeNext`)
- `tsconfig.umd.json` → UMD build → `dist/umd/` (module: `umd`, moduleResolution: `node`)

After compilation, the build scripts rename extensions:
- ESM: `.d.ts` → `.d.mts`
- UMD: `.js` → `.cjs`, `.d.ts` → `.d.cts`

The `package.json` `exports` field uses conditional exports (`import` / `require`) to direct consumers to the right format.

## TypeScript Configuration

- **Target**: ES2022
- **Strict mode**: enabled (`strict`, `strictNullChecks`, `alwaysStrict`, `noUnusedLocals`)
- **`skipLibCheck`**: `false` — type declarations in `node_modules` are checked
- Tests (`*.test.ts`, `*.spec.ts`) are excluded from compilation

## Lint

- ESLint with `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- Extends `plugin:@typescript-eslint/recommended` and `standard`
- Config is inline in `package.json` (no separate `.eslintrc`)
- Ignores `dist/*`, `node_modules/*`, and `**/*.md`

## Exports and Public API

The library exports:

| Export | Type | Description |
|--------|------|-------------|
| `serdesTagSymbol` | `Symbol` | Symbol key for a class's tag string |
| `serdesSerializeSymbol` | `Symbol` | Symbol key for a class's serialize static method |
| `serdesDeserializeSymbol` | `Symbol` | Symbol key for a class's deserialize static method |
| `serializer(data, noFn?)` | Function | Serializes data, returning `{ data, transferables, revokables }` |
| `deserializer(data)` | Function | Reconstructs serialized data |
| `deserializer.register(ctor)` | Function | Registers a custom class for deserialization |

## Architecture / Key Patterns

### Serialization Strategy

The core approach uses `JSON.parse(JSON.stringify(data, replacer), reviver)` to deeply traverse objects. The `replacer` converts unsupported types into tagged arrays (e.g., `['_', 'Map', entries]`), and the `reviver` reconstructs them. This provides an augmented `structuredClone` that handles:

- `undefined` → encoded as `['_', '_']`
- Arrays starting with `'_'` → escaped by prepending `['_', '_', ...]`
- `Map` → `['_', 'Map', entries]`
- `Set` → `['_', 'Set', values]`
- `Blob` / `File` / `ArrayBuffer` / `ArrayBufferView` / `MessagePort` / `ReadableStream` / `WritableStream` → stored in a verbatim array, referenced as `['_', '_ref', index]`
- `Error` → `['_', '_err', ref, name]` (preserves `.name`, recursively serializes `.cause`)
- Functions → converted to `MessagePort` pairs (`['_', '_fn', port]`)
- Custom classes → `['_', '_custom', tag, serializedData]` (via Symbol-based protocol)

### Custom Type Protocol

To make a class serializable, implement three static Symbol-keyed members:

```typescript
class MyClass {
  static get [serdesTagSymbol]() { return 'MyClass' }
  static [serdesSerializeSymbol](instance) { /* return serializable data */ }
  static [serdesDeserializeSymbol](data) { /* return new instance */ }
}
deserializer.register(MyClass)
```

The tag must be registered on the **receiving** side via `deserializer.register()`.

### Memory Management

- **Revokables**: The `serializer` returns a `revokables` array of `MessagePort`s that must be closed when no longer needed to prevent memory leaks.
- **`noFn` parameter**: When `true`, disables function serialization to aid memory management.
- **`FinalizationRegistry`**: Used to automatically close `MessagePort`s when deserialized function proxies are garbage collected.
- **Error cleanup**: If `JSON.stringify` throws mid-traversal, all accumulated `revokables` are closed in the `catch` block.
- **`SharedArrayBuffer` awareness**: `ArrayBufferView`s backed by `SharedArrayBuffer` are not added to `transferables` (they are shared, not transferred).

### Internal `rawResult` Pattern

A `WeakSet` tracks objects already processed by the replacer to prevent double-processing of internally constructed tagged arrays. The `rawResult` helper adds an object to this set and returns it.

## Testing Patterns

- Uses `node:test` (`describe` / `it`) and `node:assert/strict`
- `afterEach` calls `gc()` (exposed via `--expose-gc`) to speed up tests that rely on `FinalizationRegistry` cleanup
- The `afterEach` setup is wrapped in `try/catch` for Deno compatibility
- Tests exercise both basic object round-tripping and memory-leak scenarios with nested function serialization

## Gotchas

1. **`dist/` is not committed** — you must run `npm run build` before publishing.
2. **The test command also lints** — `npm test` = `npm run lint && <test runner>`. If you only want tests, run the test portion directly.
3. **Single-file library** — all logic is in `src/index.ts`. Don't create additional source files without understanding the build setup.
4. **Global `deserializerTable`** — `deserializer.register()` writes to a module-level `Object.create(null)` lookup table. Registration is global and persists for the lifetime of the module.
5. **`Error.cause` serialization is destructive on the original temporarily** — during serialization of an `Error` with a `cause`, the `cause` property is temporarily overwritten on the original object, then restored in `finally`. Be aware of this if debugging concurrent access.
6. **CI triggers on `master` branch** — the CI workflow listens on `push`/`pull_request` to `master`, but the default branch is `main`. This may be intentional or a mismatch to be aware of.

## CI

- GitHub Actions workflow at `.github/workflows/ci.yml`
- Runs on `ubuntu-latest` with Node.js 22
- Steps: `npm ci` → `npm install` → `npm test`
