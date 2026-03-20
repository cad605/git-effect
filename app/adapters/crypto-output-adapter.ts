import { createHash } from "node:crypto";

import { Effect, Layer } from "effect";

import { ObjectHash } from "../domain/models/object-hash.ts";
import {
  CryptoOutputPort,
  CryptoOutputPortError,
  type CryptoOutputPortShape,
} from "../ports/crypto-output-port.ts";

const makeImpl = Effect.gen(function* () {
  const hash: CryptoOutputPortShape["hash"] = Effect.fn("HashOutputAdapter.hash")(function* ({
    content,
  }) {
    return yield* Effect.try({
      try: () => ObjectHash.makeUnsafe(createHash("sha1").update(content).digest("hex")),
      catch: (cause) => new CryptoOutputPortError({ message: "Hashing failed", cause }),
    });
  });

  return { hash } satisfies CryptoOutputPortShape;
});

export const HashOutputAdapter = Layer.effect(CryptoOutputPort, makeImpl);
