import { type Effect, Schema, ServiceMap } from "effect";
import type { UploadPackAdvertisement } from "../domain/models/transfer-protocol.ts";

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
  }) => Effect.Effect<UploadPackAdvertisement, TransferProtocolOutputPortError, never>;
}

export class TransferProtocolOutputPort extends ServiceMap.Service<
  TransferProtocolOutputPort,
  TransferProtocolOutputPortShape
>()("app/ports/TransferProtocolOutputPort") {}
