import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { encodePktLine } from "./encode-pkt-line.ts";

describe("encodePktLine", () => {
  it.effect("fails when encoded packet length exceeds protocol max", () =>
    Effect.gen(function*() {
      const payload = new Uint8Array(0xffff - 3);
      const error = yield* Effect.flip(
        encodePktLine({
          payload,
        }),
      );

      assert.strictEqual(error.reason, "LengthOverflow");
    }));
});
