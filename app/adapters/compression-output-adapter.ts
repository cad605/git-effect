import { deflateSync, unzipSync } from "node:zlib";

import { Effect, Layer } from "effect";

import {
  CompressionOutputPort,
  CompressionOutputPortError,
} from "../ports/compression-output-port.ts";

export const CompressionOutputAdapter = Layer.sync(CompressionOutputPort, () =>
  CompressionOutputPort.of({
    zip: Effect.fn("CompressionOutputAdapter.zip")(function* (bytes: Buffer) {
      return yield* Effect.try({
        try: () => deflateSync(bytes),
        catch: (cause) => new CompressionOutputPortError({ message: "Compression failed", cause }),
      });
    }),

    unzip: Effect.fn("CompressionOutputAdapter.unzip")(function* (bytes: Buffer) {
      return yield* Effect.try({
        try: () => unzipSync(bytes),
        catch: (cause) =>
          new CompressionOutputPortError({ message: "Decompression failed", cause }),
      });
    }),
  }),
);
