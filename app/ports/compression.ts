import { Effect, Schema, ServiceMap } from "effect";

export class CompressionError extends Schema.TaggedErrorClass("CompressionError")(
  "CompressionError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export type CompressionShape = {
  unzip: (
    buffer: Buffer<ArrayBuffer>,
  ) => Effect.Effect<Buffer<ArrayBuffer>, CompressionError, never>;

  zip: (buffer: Buffer<ArrayBuffer>) => Effect.Effect<Buffer<ArrayBuffer>, CompressionError, never>;
};

export class Compression extends ServiceMap.Service<Compression, CompressionShape>()(
  "app/ports/Compression",
) {}
