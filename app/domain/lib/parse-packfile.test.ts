import { deflateSync } from "node:zlib";

import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { concatBytes } from "../utils/concat-bytes.ts";
import { parsePackfile } from "./parse-packfile.ts";

const encoder = new TextEncoder();

const packTypeCodeByName = {
  commit: 1,
  tree: 2,
  blob: 3,
  tag: 4,
  "ofs-delta": 6,
  "ref-delta": 7,
} as const;

const encodeUint32BigEndian = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
};

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

const buildNonDeltaEntry = (typeCode: number, payload: Uint8Array<ArrayBuffer>) =>
  concatBytes([
    encodePackSizeHeader({
      typeCode,
      size: payload.byteLength,
    }),
    new Uint8Array(deflateSync(payload)),
  ]);

const buildPack = ({
  version,
  entries,
  trailer,
}: {
  version: number;
  entries: Array<Uint8Array<ArrayBuffer>>;
  trailer: Uint8Array<ArrayBuffer>;
}) =>
  concatBytes([
    encoder.encode("PACK"),
    encodeUint32BigEndian(version),
    encodeUint32BigEndian(entries.length),
    ...entries,
    trailer,
  ]);

describe("parsePackfile", () => {
  it.effect("parses deterministic ordered entries with offsets", () =>
    Effect.gen(function*() {
      const firstPayload = encoder.encode("hello");
      const secondPayload = encoder.encode("world!");
      const firstEntry = buildNonDeltaEntry(packTypeCodeByName.blob, firstPayload);
      const secondEntry = buildNonDeltaEntry(packTypeCodeByName.tree, secondPayload);
      const trailer = new Uint8Array(20);
      trailer.fill(0xaa);

      const packfile = yield* parsePackfile({
        content: buildPack({
          version: 2,
          entries: [firstEntry, secondEntry],
          trailer,
        }),
      });

      assert.strictEqual(packfile.header.version, 2);
      assert.strictEqual(packfile.header.objectCount, 2);
      assert.strictEqual(packfile.entries.length, 2);

      assert.strictEqual(packfile.entries[0]?.offset, 12);
      assert.strictEqual(packfile.entries[0]?.type, "blob");
      assert.strictEqual(packfile.entries[0]?.size, firstPayload.byteLength);
      assert.deepStrictEqual(packfile.entries[0]?.payload, firstPayload);

      assert.strictEqual(packfile.entries[1]?.offset, 12 + firstEntry.byteLength);
      assert.strictEqual(packfile.entries[1]?.type, "tree");
      assert.strictEqual(packfile.entries[1]?.size, secondPayload.byteLength);
      assert.deepStrictEqual(packfile.entries[1]?.payload, secondPayload);
    }));

  it.effect("fails when pack trailer checksum bytes are missing", () =>
    Effect.gen(function*() {
      const entry = buildNonDeltaEntry(packTypeCodeByName.blob, encoder.encode("payload"));
      const error = yield* Effect.flip(
        parsePackfile({
          content: buildPack({
            version: 2,
            entries: [entry],
            trailer: new Uint8Array(0),
          }),
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "TruncatedPackData");
      }
    }));

  it.effect("fails when object stream is malformed", () =>
    Effect.gen(function*() {
      const malformedEntry = concatBytes([
        encodePackSizeHeader({
          typeCode: packTypeCodeByName.blob,
          size: 4,
        }),
        new Uint8Array([0x00, 0x01, 0x02]),
      ]);

      const error = yield* Effect.flip(
        parsePackfile({
          content: buildPack({
            version: 2,
            entries: [malformedEntry],
            trailer: new Uint8Array(20),
          }),
        }),
      );

      assert.strictEqual(error._tag, "PackfileParseError");
      if (error._tag === "PackfileParseError") {
        assert.strictEqual(error.reason._tag, "InvalidPackEntryHeader");
      }
    }));
});
