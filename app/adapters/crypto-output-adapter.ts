import { CryptoHasher } from "bun";
import { Effect, Layer } from "effect";

import { ObjectHash } from "../domain/models/object.ts";
import {
  CryptoOutputPort,
  CryptoOutputPortError,
  type CryptoOutputPortShape,
  HashingFailed,
} from "../ports/crypto-output-port.ts";

const makeImpl = Effect.gen(function*() {
  const hash: CryptoOutputPortShape["hash"] = Effect.fn("HashOutputAdapter.hash")(
    function*({
      content,
    }) {
      return ObjectHash.makeUnsafe(new CryptoHasher("sha1").update(content).digest("hex"));
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new CryptoOutputPortError({ reason: new HashingFailed({ cause }) });
      }),
    ),
  );

  return { hash } satisfies CryptoOutputPortShape;
});

export const HashOutputAdapter = Layer.effect(CryptoOutputPort, makeImpl);
