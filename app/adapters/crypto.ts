import { createHash } from "node:crypto";

import { Effect, Layer } from "effect";

import { Crypto, CryptoError } from "../ports/crypto.ts";

export const CryptoLive = Layer.effect(
  Crypto,
  Effect.gen(function* () {
    const hash = Effect.fn("Crypto.hash")(function* (buffer: Buffer) {
      return yield* Effect.try({
        try: () => createHash("sha1").update(buffer).digest("hex"),
        catch: (cause) => new CryptoError({ message: "Hashing failed", cause }),
      });
    });

    return Crypto.of({
      hash,
    });
  }),
);
