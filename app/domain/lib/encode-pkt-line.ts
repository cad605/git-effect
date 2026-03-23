import { Effect, Schema } from "effect";

import { PktLineEncodeError } from "../errors/pkt-line-error.ts";
import { concatBytes } from "../utils/concat-bytes.ts";

const encoder = new TextEncoder();

const LENGTH_PREFIX_SIZE = 4;
const MAX_PACKET_LENGTH = 0xffff;

const PktLineEncodedLength = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(LENGTH_PREFIX_SIZE),
    Schema.isLessThanOrEqualTo(MAX_PACKET_LENGTH),
  ),
);

export const encodePktLine = Effect.fn("encodePktLine")(function*({
  payload,
}: {
  payload: Uint8Array<ArrayBuffer>;
}) {
  const length = yield* Schema.decodeUnknownEffect(PktLineEncodedLength)(
    payload.length + LENGTH_PREFIX_SIZE,
  ).pipe(
    Effect.mapError(
      () =>
        new PktLineEncodeError({
          reason: "LengthOverflow",
          detail: `Pkt-line payload length ${payload.length} exceeds max packet size ${
            MAX_PACKET_LENGTH - LENGTH_PREFIX_SIZE
          }.`,
        }),
    ),
  );

  const prefix = encoder.encode(length.toString(16).padStart(4, "0"));

  return concatBytes([prefix, payload]);
});

export const encodeFlushPktLine = Effect.fn("encodeFlushPktLine")(function*() {
  return encoder.encode("0000");
});
