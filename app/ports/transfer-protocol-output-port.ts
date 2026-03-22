import { type Effect, Schema, ServiceMap } from "effect";

export class TransferProtocolOutputPortError extends Schema.TaggedErrorClass(
  "TransferProtocolOutputPortError",
)("TransferProtocolOutputPortError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export interface TransferProtocolOutputPortShape {
  discoverUploadPackRefs: ({
    url,
  }: {
    url: string;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, TransferProtocolOutputPortError, never>;
}

export class TransferProtocolOutputPort extends ServiceMap.Service<
  TransferProtocolOutputPort,
  TransferProtocolOutputPortShape
>()("app/ports/TransferProtocolOutputPort") {}
