import { CryptoHasher } from "bun";

import { Effect, Schema } from "effect";

import { ObjectHash } from "../models/object.ts";

export class HashingFailed extends Schema.TaggedErrorClass<HashingFailed>()("HashingFailed", {
  detail: Schema.String,
  cause: Schema.Defect,
}) {}

export const hashObject = Effect.fn("crypto.hashObject")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  return yield* Effect.try({
    try: () => ObjectHash.makeUnsafe(new CryptoHasher("sha1").update(content).digest("hex")),
    catch: (cause) =>
      new HashingFailed({
        detail: "Failed to hash object payload.",
        cause,
      }),
  });
});

export const hashRawSha1 = Effect.fn("crypto.hashRawSha1")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  return yield* Effect.try({
    try: () => Uint8Array.from(new CryptoHasher("sha1").update(content).digest()),
    catch: (cause) =>
      new HashingFailed({
        detail: "Failed to hash raw bytes.",
        cause,
      }),
  });
});
