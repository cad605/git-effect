import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { decodeObject } from "./decode-object.ts";

const encoder = new TextEncoder();
describe("decodeObject", () => {
  it.effect("fails when header format is not '<type> <size>'", () =>
    Effect.gen(function*() {
      const content = encoder.encode("blob\0payload");
      const error = yield* Effect.flip(
        decodeObject({
          content,
        }),
      );

      assert.strictEqual(error._tag, "ObjectDecodeError");
    }));

  it.effect("fails when header size is invalid", () =>
    Effect.gen(function*() {
      const content = encoder.encode("blob -1\0payload");
      const error = yield* Effect.flip(
        decodeObject({
          content,
        }),
      );

      assert.strictEqual(error._tag, "ObjectDecodeError");
    }));
});
