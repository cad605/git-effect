import { deflateSync, unzipSync } from "node:zlib";

import { Effect, Schema } from "effect";

export class CompressionError extends Schema.TaggedErrorClass("CompressionError")(
  "CompressionError",
  { message: Schema.String, cause: Schema.Defect },
) {}

export const zip = Effect.fn("Compression.zip")(function* (buffer: Buffer) {
  return yield* Effect.try({
    try: () => deflateSync(buffer),
    catch: (cause) => new CompressionError({ message: "Compression failed", cause }),
  });
});

export const unzip = Effect.fn("Compression.unzip")(function* (buffer: Buffer) {
  return yield* Effect.try({
    try: () => unzipSync(buffer),
    catch: (cause) => new CompressionError({ message: "Decompression failed", cause }),
  });
});
