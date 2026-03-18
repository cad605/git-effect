import { deflateSync, unzipSync } from "node:zlib";

import { Effect, Layer } from "effect";

import { Compression, CompressionError } from "../ports/compression.ts";

export const CompressionLive = Layer.effect(
  Compression,
  Effect.gen(function* () {
    const unzip = Effect.fn("Compression.unzip")(function* (buffer: Buffer) {
      return yield* Effect.try({
        try: () => unzipSync(buffer),
        catch: (cause) => new CompressionError({ message: "Decompression failed", cause }),
      });
    });

    const zip = Effect.fn("Compression.zip")(function* (buffer: Buffer) {
      return yield* Effect.try({
        try: () => deflateSync(buffer),
        catch: (cause) => new CompressionError({ message: "Compression failed", cause }),
      });
    });

    return Compression.of({
      unzip,
      zip,
    });
  }),
);
