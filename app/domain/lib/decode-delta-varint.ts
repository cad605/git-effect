import { Effect } from "effect";

import { MalformedDeltaInstruction, PackfileParseError } from "../errors/packfile-parse-error.ts";

export const decodeDeltaVarint = Effect.fn("decodeDeltaVarint")(function*({
  content,
  offset,
  context,
}: {
  content: Uint8Array<ArrayBuffer>;
  offset: number;
  context: string;
}) {
  let cursor = offset;
  let value = 0;
  let shift = 0;

  while (true) {
    if (cursor >= content.byteLength) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaInstruction({
            detail: `Truncated delta varint while decoding ${context} at offset ${offset}.`,
          }),
        }),
      );
    }

    const byte = content[cursor];
    cursor += 1;

    value += (byte & 0b01111111) * 2 ** shift;
    if (!Number.isSafeInteger(value)) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaInstruction({
            detail: `Delta varint exceeds supported number range while decoding ${context} at offset ${offset}.`,
          }),
        }),
      );
    }

    if ((byte & 0b10000000) === 0) {
      return { value, cursor } as const;
    }

    shift += 7;
    if (shift > 56) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaInstruction({
            detail: `Delta varint is too large while decoding ${context} at offset ${offset}.`,
          }),
        }),
      );
    }
  }
});
