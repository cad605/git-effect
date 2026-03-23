import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { parsePackHeader } from "./parse-pack-header.ts";

const encoder = new TextEncoder();

const encodeUint32BigEndian = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
};

const buildPackHeader = ({ version, objectCount }: { version: number; objectCount: number }) =>
  new Uint8Array([
    ...encoder.encode("PACK"),
    ...encodeUint32BigEndian(version),
    ...encodeUint32BigEndian(objectCount),
  ]);

describe("parsePackHeader", () => {
  it.effect("parses PACK signature, version, and object count", () =>
    Effect.gen(function*() {
      const header = yield* parsePackHeader({
        content: buildPackHeader({ version: 2, objectCount: 3 }),
      });

      assert.strictEqual(header.version, 2);
      assert.strictEqual(header.objectCount, 3);
    }));

  it.effect("fails on invalid signature", () =>
    Effect.gen(function*() {
      const invalid = buildPackHeader({ version: 2, objectCount: 1 });
      invalid.set(encoder.encode("BORK"), 0);

      const error = yield* Effect.flip(
        parsePackHeader({
          content: invalid,
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "InvalidPackSignature");
      }
    }));

  it.effect("fails on unsupported version", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        parsePackHeader({
          content: buildPackHeader({ version: 1, objectCount: 1 }),
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "UnsupportedPackVersion");
      }
    }));

  it.effect("fails on truncated header", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        parsePackHeader({
          content: encoder.encode("PACK"),
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "TruncatedPackData");
      }
    }));
});
