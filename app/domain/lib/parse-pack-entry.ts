import { inflateSync } from "node:zlib";

import { Effect, Encoding, Schema } from "effect";

import {
  InflatedSizeMismatch,
  InvalidPackEntryHeader,
  InvalidPackObjectType,
  MalformedDeltaBaseReference,
  PackfileParseError,
  TruncatedPackData,
} from "../errors/packfile-parse-error.ts";
import { ObjectHash } from "../models/object.ts";
import { PackEntry, PackObjectType } from "../models/packfile.ts";

const PACK_TYPE_BY_CODE = new Map<number, PackObjectType>([
  [1, PackObjectType.makeUnsafe("commit")],
  [2, PackObjectType.makeUnsafe("tree")],
  [3, PackObjectType.makeUnsafe("blob")],
  [4, PackObjectType.makeUnsafe("tag")],
  [6, PackObjectType.makeUnsafe("ofs-delta")],
  [7, PackObjectType.makeUnsafe("ref-delta")],
]);

const InflateInfoResult = Schema.Struct({
  buffer: Schema.instanceOf(Uint8Array),
  engine: Schema.Struct({
    bytesWritten: Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))),
  }),
});

const decodeEntryHeader = Effect.fn("decodeEntryHeader")(function*(
  { content, offset }: { content: Uint8Array<ArrayBuffer>; offset: number },
) {
  if (offset >= content.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new TruncatedPackData({
          detail: `Missing pack entry header at offset ${offset}.`,
        }),
      }),
    );
  }

  let cursor = offset;
  const firstByte = content[cursor];
  cursor += 1;

  const typeCode = (firstByte >> 4) & 0b111;
  const type = PACK_TYPE_BY_CODE.get(typeCode);
  if (!type) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new InvalidPackObjectType({
          typeCode,
          detail: `Unsupported pack object type code '${typeCode}' at offset ${offset}.`,
        }),
      }),
    );
  }

  let size = firstByte & 0b1111;
  let shift = 4;
  let hasContinuation = (firstByte & 0b10000000) !== 0;

  while (hasContinuation) {
    if (cursor >= content.byteLength) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new TruncatedPackData({
            detail: `Truncated pack entry size varint at offset ${offset}.`,
          }),
        }),
      );
    }

    const nextByte = content[cursor];
    cursor += 1;
    size |= (nextByte & 0b01111111) << shift;
    shift += 7;
    hasContinuation = (nextByte & 0b10000000) !== 0;

    if (shift > 32) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new InvalidPackEntryHeader({
            detail: `Pack entry size varint exceeds supported range at offset ${offset}.`,
          }),
        }),
      );
    }
  }

  return { type, size, cursor } as const;
});

const decodeOfsDeltaBaseOffset = Effect.fn("decodeOfsDeltaBaseOffset")(function*(
  { content, offset, entryOffset }: { content: Uint8Array<ArrayBuffer>; offset: number; entryOffset: number },
) {
  if (offset >= content.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new MalformedDeltaBaseReference({
          detail: `Missing ofs-delta base offset data at offset ${offset}.`,
        }),
      }),
    );
  }

  let cursor = offset;
  let byte = content[cursor];
  cursor += 1;
  let distance = byte & 0b01111111;

  while ((byte & 0b10000000) !== 0) {
    if (cursor >= content.byteLength) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaBaseReference({
            detail: `Truncated ofs-delta base offset varint for entry at offset ${entryOffset}.`,
          }),
        }),
      );
    }

    byte = content[cursor];
    cursor += 1;
    distance = ((distance + 1) << 7) + (byte & 0b01111111);
  }

  const baseOffset = entryOffset - distance;
  if (baseOffset < 0) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new MalformedDeltaBaseReference({
          detail: `ofs-delta base offset underflow at entry offset ${entryOffset}.`,
        }),
      }),
    );
  }

  return { baseOffset, cursor } as const;
});

const decodeRefDeltaBaseHash = Effect.fn("decodeRefDeltaBaseHash")(
  function*({ content, offset }: { content: Uint8Array<ArrayBuffer>; offset: number }) {
    const HASH_LENGTH = 20;

    if (offset + HASH_LENGTH > content.byteLength) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaBaseReference({
            detail: `Truncated ref-delta base hash at offset ${offset}.`,
          }),
        }),
      );
    }

    const baseHash = ObjectHash.makeUnsafe(Encoding.encodeHex(content.subarray(offset, offset + HASH_LENGTH)));

    return { baseHash, cursor: offset + HASH_LENGTH } as const;
  },
);

const inflatePackEntryPayload = Effect.fn("inflatePackEntryPayload")(function*(
  { content, offset }: { content: Uint8Array<ArrayBuffer>; offset: number },
) {
  if (offset >= content.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new TruncatedPackData({
          detail: `Missing compressed payload at offset ${offset}.`,
        }),
      }),
    );
  }

  const compressed = content.subarray(offset);

  const inflatedResult = yield* Effect.try({
    try: () => inflateSync(compressed, { info: true }),
    catch: (cause) =>
      new PackfileParseError({
        reason: new InvalidPackEntryHeader({
          detail: `Failed to inflate pack entry payload at offset ${offset}: ${String(cause)}`,
        }),
      }),
  });

  const parsedInflateInfo = yield* Schema.decodeUnknownEffect(InflateInfoResult)(inflatedResult).pipe(
    Effect.mapError(
      () =>
        new PackfileParseError({
          reason: new InvalidPackEntryHeader({
            detail: `Inflate engine did not provide stream metadata at offset ${offset}.`,
          }),
        }),
    ),
  );

  const consumedBytes = parsedInflateInfo.engine.bytesWritten;
  if (offset + consumedBytes > content.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new InvalidPackEntryHeader({
          detail: `Invalid compressed payload length '${consumedBytes}' at offset ${offset}.`,
        }),
      }),
    );
  }

  return {
    payload: new Uint8Array(parsedInflateInfo.buffer),
    nextOffset: offset + consumedBytes,
  } as const;
});

export const parsePackEntry = Effect.fn("parsePackEntry")(function*({
  content,
  offset,
}: {
  content: Uint8Array<ArrayBuffer>;
  offset: number;
}) {
  const { type, size, cursor: afterHeader } = yield* decodeEntryHeader({ content, offset });

  let payloadOffset = afterHeader;
  let baseOffset: number | undefined;
  let baseHash: ObjectHash | undefined;

  if (type === "ofs-delta") {
    const decoded = yield* decodeOfsDeltaBaseOffset({ content, offset, entryOffset: offset });
    baseOffset = decoded.baseOffset;
    payloadOffset = decoded.cursor;
  }

  if (type === "ref-delta") {
    const decoded = yield* decodeRefDeltaBaseHash({ content, offset: payloadOffset });
    baseHash = decoded.baseHash;
    payloadOffset = decoded.cursor;
  }

  const { payload, nextOffset } = yield* inflatePackEntryPayload({ content, offset: payloadOffset });

  if (type !== "ofs-delta" && type !== "ref-delta" && payload.byteLength !== size) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new InflatedSizeMismatch({
          expectedSize: size,
          actualSize: payload.byteLength,
          detail: `Inflated payload size mismatch for '${type}' entry at offset ${offset}.`,
        }),
      }),
    );
  }

  return {
    entry: new PackEntry({
      offset,
      type,
      size,
      payload,
      baseOffset,
      baseHash,
    }),
    nextOffset,
  } as const;
});
