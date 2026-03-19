import { createHash } from "node:crypto";

import { Effect, Schema } from "effect";

import { ObjectHash } from "./models/object-hash.ts";

export class HashingError extends Schema.TaggedErrorClass("HashingError")("HashingError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export const sha1 = Effect.fn("Crypto.sha1")(function* (buffer: Buffer) {
  return yield* Effect.try({
    try: () => ObjectHash.makeUnsafe(createHash("sha1").update(buffer).digest("hex")),
    catch: (cause) => new HashingError({ message: "Hashing failed", cause }),
  });
});
