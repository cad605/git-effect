import { type Effect, Schema, ServiceMap } from "effect";

export class ZipFailed extends Schema.TaggedErrorClass<ZipFailed>()("ZipFailed", {
  cause: Schema.Defect,
}) {}

export class UnzipFailed extends Schema.TaggedErrorClass<UnzipFailed>()("UnzipFailed", {
  cause: Schema.Defect,
}) {}

export class CompressionOutputPortError extends Schema.TaggedErrorClass<CompressionOutputPortError>()(
  "CompressionOutputPortError",
  {
    reason: Schema.Union([ZipFailed, UnzipFailed]),
  },
) {}

export type CompressionOutputPortShape = {
  zip: ({
    content,
  }: {
    content: Uint8Array<ArrayBuffer>;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, CompressionOutputPortError, never>;

  unzip: ({
    content,
  }: {
    content: Uint8Array<ArrayBuffer>;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, CompressionOutputPortError, never>;
};

export class CompressionOutputPort extends ServiceMap.Service<
  CompressionOutputPort,
  CompressionOutputPortShape
>()("app/application/ports/CompressionOutputPort") {}
