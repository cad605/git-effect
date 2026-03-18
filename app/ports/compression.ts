import { Effect, ServiceMap } from "effect";

export type CompressionShape = {
  unzip: (compressed: Buffer<ArrayBuffer>) => Effect.Effect<Buffer<ArrayBuffer>, Error, never>;
};

export class Compression extends ServiceMap.Service<Compression, CompressionShape>()(
  "app/ports/Compression",
) {}
