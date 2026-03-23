import { deflateSync } from "node:zlib";

import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { concatBytes } from "../utils/concat-bytes.ts";
import { parsePackEntry } from "./parse-pack-entry.ts";

const encoder = new TextEncoder();

const packTypeCodeByName = {
  commit: 1,
  tree: 2,
  blob: 3,
  tag: 4,
  "ofs-delta": 6,
  "ref-delta": 7,
} as const;

const encodePackSizeHeader = ({
  typeCode,
  size,
}: {
  typeCode: number;
  size: number;
}) => {
  const bytes = [(size & 0b1111) | (typeCode << 4)];
  let remaining = size >>> 4;

  if (remaining > 0) {
    bytes[0] |= 0b10000000;
  }

  while (remaining > 0) {
    let next = remaining & 0b01111111;
    remaining >>>= 7;
    if (remaining > 0) {
      next |= 0b10000000;
    }
    bytes.push(next);
  }

  return new Uint8Array(bytes);
};

describe("parsePackEntry", () => {
  it.effect("parses non-delta entry with multi-byte size header and inflates payload", () =>
    Effect.gen(function*() {
      const payload = encoder.encode("a".repeat(300));
      const compressed = deflateSync(payload);
      const entry = concatBytes([
        encodePackSizeHeader({
          typeCode: packTypeCodeByName.blob,
          size: payload.byteLength,
        }),
        new Uint8Array(compressed),
      ]);

      const parsed = yield* parsePackEntry({
        content: entry,
        offset: 0,
      });

      assert.strictEqual(parsed.entry.type, "blob");
      assert.strictEqual(parsed.entry.size, 300);
      assert.strictEqual(parsed.entry.offset, 0);
      assert.strictEqual(parsed.entry.payload.byteLength, payload.byteLength);
      assert.deepStrictEqual(parsed.entry.payload, payload);
      assert.strictEqual(parsed.nextOffset, entry.byteLength);
    }));

  it.effect("parses ref-delta base hash metadata and preserves delta instruction bytes", () =>
    Effect.gen(function*() {
      const deltaInstructions = new Uint8Array([0x03, 0x05, 0x80, 0x03, 0x58, 0x59, 0x5a]);
      const compressedDelta = deflateSync(deltaInstructions);
      const baseHash = "1111111111111111111111111111111111111111";
      const baseHashBytes = new Uint8Array(Buffer.from(baseHash, "hex"));
      const entry = concatBytes([
        encodePackSizeHeader({
          typeCode: packTypeCodeByName["ref-delta"],
          size: 123,
        }),
        baseHashBytes,
        new Uint8Array(compressedDelta),
      ]);

      const parsed = yield* parsePackEntry({
        content: entry,
        offset: 0,
      });

      assert.strictEqual(parsed.entry.type, "ref-delta");
      assert.strictEqual(parsed.entry.size, 123);
      assert.strictEqual(String(parsed.entry.baseHash), baseHash);
      assert.deepStrictEqual(parsed.entry.payload, deltaInstructions);
    }));

  it.effect("fails on unsupported pack object type code", () =>
    Effect.gen(function*() {
      const header = encodePackSizeHeader({
        typeCode: 5,
        size: 1,
      });
      const malformedEntry = concatBytes([
        header,
        new Uint8Array(deflateSync(encoder.encode("x"))),
      ]);

      const error = yield* Effect.flip(
        parsePackEntry({
          content: malformedEntry,
          offset: 0,
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "InvalidPackObjectType");
      }
    }));

  it.effect("fails on truncated size varint", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        parsePackEntry({
          content: new Uint8Array([0b10110000]),
          offset: 0,
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "TruncatedPackData");
      }
    }));
});
