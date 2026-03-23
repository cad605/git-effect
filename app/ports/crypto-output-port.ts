import { type Effect, Schema, ServiceMap } from "effect";

import type { ObjectHash } from "../domain/models/object.ts";

export class HashingFailed extends Schema.TaggedErrorClass<HashingFailed>()("HashingFailed", {
  cause: Schema.Defect,
}) {}

export class CryptoOutputPortError extends Schema.TaggedErrorClass<CryptoOutputPortError>()("CryptoOutputPortError", {
  reason: Schema.Union([HashingFailed]),
}) {}

export interface CryptoOutputPortShape {
  hash: ({
    content,
  }: {
    content: Uint8Array<ArrayBuffer>;
  }) => Effect.Effect<ObjectHash, CryptoOutputPortError, never>;
}

export class CryptoOutputPort extends ServiceMap.Service<CryptoOutputPort, CryptoOutputPortShape>()(
  "app/ports/CryptoOutputPort",
) {}
