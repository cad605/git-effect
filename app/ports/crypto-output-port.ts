import { type Effect, Schema, ServiceMap } from "effect";

import type { ObjectHash } from "../domain/models/object.ts";

export class CryptoOutputPortError extends Schema.TaggedErrorClass("CryptoOutputPortError")(
  "CryptoOutputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

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
