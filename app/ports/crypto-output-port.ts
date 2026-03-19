import { Schema, ServiceMap, type Effect } from "effect";

import type { ObjectHash } from "../models/object-hash.ts";

export class CryptoOutputPortError extends Schema.TaggedErrorClass("CryptoOutputPortError")(
  "CryptoOutputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export type CryptoOutputPortShape = {
  hash: (bytes: Buffer) => Effect.Effect<ObjectHash, CryptoOutputPortError, never>;
};

export class CryptoOutputPort extends ServiceMap.Service<CryptoOutputPort, CryptoOutputPortShape>()(
  "app/application/ports/CryptoOutputPort",
) {}
