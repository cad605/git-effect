import { type Effect, Schema, ServiceMap } from "effect";

export class CompressionOutputPortError extends Schema.TaggedErrorClass(
  "CompressionOutputPortError",
)("CompressionOutputPortError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

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
