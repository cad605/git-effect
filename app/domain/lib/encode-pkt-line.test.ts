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

      assert.strictEqual(error._tag, "PktLineEncodeError");
      assert.strictEqual(error.reason._tag, "LengthOverflow");
    }));

  it.effect("recovers overflow using catchReason", () =>
    Effect.gen(function*() {
      const payload = new Uint8Array(0xffff - 3);

      const detail = yield* encodePktLine({
        payload,
      }).pipe(
        Effect.catchReason(
          "PktLineEncodeError",
          "LengthOverflow",
          (reason) => Effect.succeed(reason.detail),
        ),
      );

      assert.strictEqual(
        detail,
        `Pkt-line payload length ${payload.length} exceeds max packet size ${0xffff - 4}.`,
      );
    }));
});
