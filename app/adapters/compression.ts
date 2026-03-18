import { unzipSync } from "node:zlib";

import { Effect, Layer } from "effect";

import { Compression } from "../ports/compression.ts";

export const CompressionLive = Layer.effect(
  Compression,
  Effect.gen(function* () {
    const unzip = Effect.fn("Compression.unzip")(function* (compressed: Buffer) {
      return yield* Effect.try({
        try: () => unzipSync(compressed),
        catch: (e) => new Error(`Decompression failed: ${e}`),
      });
    });

    return Compression.of({
      unzip,
    });
  }),
);
