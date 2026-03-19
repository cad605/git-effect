import { Schema, ServiceMap, type Effect } from "effect";

export class CompressionOutputPortError extends Schema.TaggedErrorClass(
  "CompressionOutputPortError",
)("CompressionOutputPortError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export type CompressionOutputPortShape = {
  zip: (bytes: Buffer) => Effect.Effect<Buffer, CompressionOutputPortError, never>;
  unzip: (bytes: Buffer) => Effect.Effect<Buffer, CompressionOutputPortError, never>;
};

export class CompressionOutputPort extends ServiceMap.Service<
  CompressionOutputPort,
  CompressionOutputPortShape
>()("app/application/ports/CompressionOutputPort") {}
