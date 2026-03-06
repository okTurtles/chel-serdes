# @chelonia/serdes

A TypeScript library for serializing and deserializing complex JavaScript objects that neither `structuredClone` nor `JSON` support. It enables sharing custom objects — including functions, `Map`, `Set`, `Error`, `Blob`, `File`, `ArrayBuffer`, `MessagePort`, and more — across `MessagePort` boundaries.

## Why?

`structuredClone` does not support custom objects ([whatwg/html#7428](https://github.com/whatwg/html/issues/7428)). `JSON` cannot handle `undefined`, `Map`, `Set`, `Error`, binary data, or functions. This library bridges the gap by providing an augmented deep-clone mechanism that works with `postMessage` and `MessagePort`.

## Install

```bash
npm install @chelonia/serdes
```

## Quick Start

```typescript
import { serializer, deserializer } from '@chelonia/serdes'

const source = {
  name: 'example',
  tags: new Set(['a', 'b']),
  metadata: new Map([['key', 'value']]),
  optional: undefined
}

// Serialize
const { data, transferables, revokables } = serializer(source)

// Send via MessagePort
port.postMessage(data, transferables)

// On the receiving side, reconstruct the original object
const reconstructed = deserializer(data)
```

## API

### `serializer(data, noFn?)`

Serializes `data` into a form suitable for `structuredClone` / `postMessage`.

- **`data`** — Any value to serialize.
- **`noFn`** *(optional)* — If `true`, disables function serialization (useful for memory management).

Returns `{ data, transferables, revokables }`:

| Field | Type | Description |
|-------|------|-------------|
| `data` | `unknown` | The serialized payload, safe for `postMessage` |
| `transferables` | `Transferables[]` | Objects to pass as the second argument to `postMessage` |
| `revokables` | `MessagePort[]` | Ports that **must** be closed when no longer needed to prevent memory leaks |

### `deserializer(data)`

Reconstructs serialized data on the receiving side.

```typescript
const original = deserializer(received.data)
```

### `deserializer.register(Constructor)`

Registers a custom class for deserialization. Must be called on the **receiving** side for every custom type that may appear in messages.

```typescript
deserializer.register(MyClass)
```

### Symbols

| Export | Purpose |
|--------|---------|
| `serdesTagSymbol` | Symbol key for a class's unique tag string |
| `serdesSerializeSymbol` | Symbol key for a class's static serialize method |
| `serdesDeserializeSymbol` | Symbol key for a class's static deserialize method |

## Supported Types

| Type | Encoding |
|------|----------|
| `undefined` | `['_', '_']` |
| `Map` | `['_', 'Map', entries]` |
| `Set` | `['_', 'Set', values]` |
| `Blob` / `File` | Stored verbatim via `_ref` |
| `Error` | `['_', '_err', ref, name]` — preserves `.name` and recursively serializes `.cause` |
| `MessagePort` / `ReadableStream` / `WritableStream` / `ArrayBuffer` / `ArrayBufferView` | Stored verbatim and added to `transferables` |
| Functions | Converted to `MessagePort` pairs (`['_', '_fn', port]`) |
| Custom classes | `['_', '_custom', tag, serializedData]` via the Symbol protocol |

## Custom Types

Make any class serializable by implementing three static Symbol-keyed members:

```typescript
import {
  serdesTagSymbol,
  serdesSerializeSymbol,
  serdesDeserializeSymbol,
  deserializer
} from '@chelonia/serdes'

class Coordinate {
  x: number
  y: number

  constructor (x: number, y: number) {
    this.x = x
    this.y = y
  }

  static get [serdesTagSymbol] () { return 'Coordinate' }

  static [serdesSerializeSymbol] (instance: Coordinate) {
    return { x: instance.x, y: instance.y }
  }

  static [serdesDeserializeSymbol] (data: { x: number, y: number }) {
    return new Coordinate(data.x, data.y)
  }
}

// Register on the receiving side
deserializer.register(Coordinate)
```

## Memory Management

- **Close revokables**: The `serializer` returns a `revokables` array of `MessagePort`s. Close them when no longer needed to prevent memory leaks.
- **`noFn` parameter**: Pass `true` to disable function serialization when you don't need it.
- **Automatic cleanup**: `FinalizationRegistry` is used to automatically close `MessagePort`s when deserialized function proxies are garbage collected.

## Build

The library ships both ESM and UMD formats:

```bash
npm run build       # Build both formats
npm run build:esm   # ESM only  → dist/esm/
npm run build:umd   # UMD only  → dist/umd/
```

## Development

```bash
npm install
npm test            # Lint + tests
npm run lint        # Lint only
```

Tests use the Node.js built-in test runner (`node:test`) and `node:assert/strict`. The `--expose-gc` flag is required for memory-leak tests that rely on `FinalizationRegistry`.

## License

[MIT](LICENSE) — okTurtles Foundation, Inc.
