import { Effect, Schema, SchemaGetter } from "effect";

import { PktLineDecodeError } from "../errors/pkt-line-error.ts";

const decoder = new TextDecoder();

const LENGTH_PREFIX_SIZE = 4;
const FLUSH_LENGTH = 0;
const MINIMUM_PACKET_LENGTH = 4;
const MAX_PACKET_LENGTH = 0xffff;
const HEX_LENGTH_PATTERN = /^[0-9a-fA-F]{4}$/;

class PktLineData extends Schema.TaggedClass<PktLineData>()("Data", {
  payload: Schema.instanceOf(Uint8Array<ArrayBuffer>),
}) {}

class PktLineFlush extends Schema.TaggedClass<PktLineFlush>()("Flush", {}) {}

const PktLine = Schema.Union([PktLineData, PktLineFlush]);

type PktLine = typeof PktLine.Type;

const PktLineHexPrefix = Schema.String.pipe(Schema.check(Schema.isPattern(HEX_LENGTH_PATTERN)));

const PktLineLengthFromHexPrefix = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform((value) => Number.parseInt(value, 16)),
    encode: SchemaGetter.transform((value) => value.toString(16).padStart(LENGTH_PREFIX_SIZE, "0")),
  }),
  Schema.check(Schema.isInt(), Schema.isBetween({ minimum: FLUSH_LENGTH, maximum: MAX_PACKET_LENGTH })),
  Schema.refine(
    (value): value is number => value === FLUSH_LENGTH || value >= MINIMUM_PACKET_LENGTH,
    {
      description: "pkt-line length must be 0000 (flush) or >= 0004",
    },
  ),
);

const decodeLength = Effect.fn("decodeLength")(function*(buffer: Uint8Array<ArrayBuffer>, offset: number) {
  if (offset + LENGTH_PREFIX_SIZE > buffer.length) {
    return yield* Effect.fail(
      new PktLineDecodeError({
        reason: "UnexpectedEOF",
        detail: `Missing length prefix at offset ${offset}.`,
      }),
    );
  }

  const prefix = decoder.decode(buffer.subarray(offset, offset + LENGTH_PREFIX_SIZE));

  const validPrefix = yield* Schema.decodeUnknownEffect(PktLineHexPrefix)(prefix).pipe(
    Effect.mapError(
      () =>
        new PktLineDecodeError({
          reason: "InvalidLengthPrefix",
          detail: `Invalid pkt-line length prefix '${prefix}' at offset ${offset}.`,
        }),
    ),
  );

  return yield* Schema.decodeUnknownEffect(PktLineLengthFromHexPrefix)(validPrefix).pipe(
    Effect.mapError(
      () =>
        new PktLineDecodeError({
          reason: "InvalidLengthValue",
          detail: `Failed to parse pkt-line length '${prefix}' at offset ${offset}.`,
        }),
    ),
  );
});

const decodePktLineAt = Effect.fn("decodePktLineAt")(
  function*({
    content,
    offset,
  }: {
    content: Uint8Array<ArrayBuffer>;
    offset: number;
  }) {
    const length = yield* decodeLength(content, offset);

    if (length === FLUSH_LENGTH) {
      return { line: new PktLineFlush({}), nextOffset: offset + LENGTH_PREFIX_SIZE };
    }

    const payloadLength = length - LENGTH_PREFIX_SIZE;
    const payloadStart = offset + LENGTH_PREFIX_SIZE;
    const payloadEnd = payloadStart + payloadLength;

    if (payloadEnd > content.length) {
      return yield* Effect.fail(
        new PktLineDecodeError({
          reason: "UnexpectedEOF",
          detail: `Expected ${payloadLength} payload bytes at offset ${payloadStart}, but stream ended at ${content.length}.`,
        }),
      );
    }

    return {
      line: new PktLineData({ payload: content.subarray(payloadStart, payloadEnd) }),
      nextOffset: payloadEnd,
    };
  },
);

export const decodePktLines = Effect.fn("decodePktLines")(function*({
  content,
}: {
  content: Uint8Array<ArrayBuffer>;
}) {
  const lines: Array<PktLine> = [];
  
  let offset = 0;
  while (offset < content.length) {
    const { line, nextOffset } = yield* decodePktLineAt({ content, offset });
    
    lines.push(line);
    
    offset = nextOffset;
  }

  return lines;
});
