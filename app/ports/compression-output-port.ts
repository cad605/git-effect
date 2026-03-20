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
    content: Buffer;
  }) => Effect.Effect<Buffer, CompressionOutputPortError, never>;

  unzip: ({
    content,
  }: {
    content: Buffer;
  }) => Effect.Effect<Buffer, CompressionOutputPortError, never>;
};

export class CompressionOutputPort extends ServiceMap.Service<
  CompressionOutputPort,
  CompressionOutputPortShape
>()("app/application/ports/CompressionOutputPort") {}
