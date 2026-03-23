import { deflateSync, inflateSync } from "node:zlib";

import { Effect, Schema } from "effect";

export class CompressionFailed extends Schema.TaggedErrorClass<CompressionFailed>()("CompressionFailed", {
  detail: Schema.String,
  cause: Schema.Defect,
}) {}

export class DecompressionFailed extends Schema.TaggedErrorClass<DecompressionFailed>()("DecompressionFailed", {
  detail: Schema.String,
  cause: Schema.Defect,
}) {}

export const zip = Effect.fn("compression.zip")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  return yield* Effect.try({
    try: () => deflateSync(content),
    catch: (cause) =>
      new CompressionFailed({
        detail: "Failed to deflate content.",
        cause,
      }),
  });
});

export const unzip = Effect.fn("compression.unzip")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  return yield* Effect.try({
    try: () => inflateSync(content),
    catch: (cause) =>
      new DecompressionFailed({
        detail: "Failed to inflate content.",
        cause,
      }),
  });
});

export const inflateRaw = Effect.fn("compression.inflateRaw")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  const { buffer, engine: { bytesWritten: compressedSize } } = yield* Effect.try({
    try: () =>
      inflateSync(content, { info: true }) as unknown as {
        buffer: Uint8Array<ArrayBuffer>;
        engine: {
          bytesWritten: number;
        };
      },
    catch: (cause) =>
      new DecompressionFailed({
        detail: "Failed to inflate raw entry payload.",
        cause,
      }),
  });

  return {
    inflated: new Uint8Array(buffer),
    compressedSize,
  } as const;
});
