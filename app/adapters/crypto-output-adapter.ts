import { createHash } from "node:crypto";

import { Effect, Layer } from "effect";

import { ObjectHash } from "../models/object-hash.ts";
import { CryptoOutputPort, CryptoOutputPortError } from "../ports/crypto-output-port.ts";

export const HashOutputAdapter = Layer.sync(CryptoOutputPort, () =>
  CryptoOutputPort.of({
    hash: Effect.fn("HashOutputAdapter.hash")(function* (bytes: Buffer) {
      return yield* Effect.try({
        try: () => ObjectHash.makeUnsafe(createHash("sha1").update(bytes).digest("hex")),
        catch: (cause) => new CryptoOutputPortError({ message: "Hashing failed", cause }),
      });
    }),
  }),
);
