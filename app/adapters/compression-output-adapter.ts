import { deflateSync, unzipSync } from "node:zlib";

import { Effect, Layer } from "effect";

import {
  CompressionOutputPort,
  CompressionOutputPortError,
  type CompressionOutputPortShape,
} from "../ports/compression-output-port.ts";

const makeImpl = Effect.gen(function*() {
  const zip: CompressionOutputPortShape["zip"] = Effect.fn("CompressionOutputAdapter.zip")(
    function*({ content }) {
      return deflateSync(content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new CompressionOutputPortError({ message: "Compression failed", cause });
      }),
    ),
  );

  const unzip: CompressionOutputPortShape["unzip"] = Effect.fn("CompressionOutputAdapter.unzip")(
    function*({ content }) {
      return unzipSync(content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new CompressionOutputPortError({ message: "Compression failed", cause });
      }),
    ),
  );

  return { zip, unzip } satisfies CompressionOutputPortShape;
});

export const CompressionOutputAdapter = Layer.effect(CompressionOutputPort, makeImpl);
