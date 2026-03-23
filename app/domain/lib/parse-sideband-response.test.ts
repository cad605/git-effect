import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { concatBytes } from "../utils/concat-bytes.ts";
import { encodeFlushPktLine, encodePktLine } from "./encode-pkt-line.ts";
import { parseSidebandResponse } from "./parse-sideband-response.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const sidebandPacket = Effect.fn("sidebandPacket")(function*({
  channel,
  content,
}: {
  channel: number;
  content: string | Uint8Array<ArrayBuffer>;
}) {
  const payloadContent = typeof content === "string" ? encoder.encode(content) : content;
  const payload = new Uint8Array(payloadContent.length + 1);
  payload[0] = channel;
  payload.set(payloadContent, 1);

  return yield* encodePktLine({ payload });
});

describe("parseSidebandResponse", () => {
  it.effect("concatenates sideband channel 1 payloads and captures progress packets", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({ payload: encoder.encode("NAK\n") }),
        sidebandPacket({ channel: 2, content: "Counting objects: 2\n" }),
        sidebandPacket({ channel: 1, content: encoder.encode("PACK") }),
        sidebandPacket({ channel: 1, content: encoder.encode("\x00\x00\x00\x02") }),
        sidebandPacket({ channel: 2, content: "Compressing objects: 100%\n" }),
        encodeFlushPktLine(),
      ]);

      const result = yield* parseSidebandResponse({
        content: concatBytes(packets),
      });

      assert.strictEqual(decoder.decode(result.packBytes.subarray(0, 4)), "PACK");
      assert.strictEqual(result.packBytes.byteLength, 8);
      assert.deepStrictEqual(result.progressMessages, [
        "Counting objects: 2\n",
        "Compressing objects: 100%\n",
      ]);
    }));

  it.effect("fails fast on sideband channel 3 (fatal)", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({ payload: encoder.encode("NAK\n") }),
        sidebandPacket({ channel: 3, content: "fatal: no matching ref\n" }),
      ]);

      const error = yield* Effect.flip(
        parseSidebandResponse({
          content: concatBytes(packets),
        }),
      );
      assert.strictEqual(error._tag, "SidebandParseError");
      if (error._tag === "SidebandParseError") {
        assert.strictEqual(error.reason._tag, "FatalSidebandMessage");
      }
    }));

  it.effect("fails when a sideband packet uses an unknown channel", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({ payload: encoder.encode("NAK\n") }),
        sidebandPacket({ channel: 9, content: "unexpected" }),
      ]);

      const error = yield* Effect.flip(
        parseSidebandResponse({
          content: concatBytes(packets),
        }),
      );
      assert.strictEqual(error._tag, "SidebandParseError");
      if (error._tag === "SidebandParseError") {
        assert.strictEqual(error.reason._tag, "UnknownSidebandChannel");
      }
    }));

  it.effect("fails when no channel 1 pack data is present", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({ payload: encoder.encode("NAK\n") }),
        sidebandPacket({ channel: 2, content: "Resolving deltas: 100%\n" }),
        encodeFlushPktLine(),
      ]);

      const error = yield* Effect.flip(
        parseSidebandResponse({
          content: concatBytes(packets),
        }),
      );
      assert.strictEqual(error._tag, "SidebandParseError");
      if (error._tag === "SidebandParseError") {
        assert.strictEqual(error.reason._tag, "MissingPackData");
      }
    }));
});
