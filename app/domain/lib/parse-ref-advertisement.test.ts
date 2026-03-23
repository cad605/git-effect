import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { concatBytes } from "../utils/concat-bytes.ts";
import { encodeFlushPktLine, encodePktLine } from "./encode-pkt-line.ts";
import { parseRefAdvertisement } from "./parse-ref-advertisement.ts";

const encoder = new TextEncoder();

describe("parseRefAdvertisement", () => {
  it.effect("parses refs, first-line capabilities, and HEAD symref target", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({
          payload: encoder.encode("# service=git-upload-pack\n"),
        }),
        encodeFlushPktLine(),
        encodePktLine({
          payload: encoder.encode(
            "1111111111111111111111111111111111111111 HEAD\0multi_ack symref=HEAD:refs/heads/main side-band-64k ofs-delta\n",
          ),
        }),
        encodePktLine({
          payload: encoder.encode("1111111111111111111111111111111111111111 refs/heads/main\n"),
        }),
        encodePktLine({
          payload: encoder.encode("2222222222222222222222222222222222222222 refs/heads/feature\n"),
        }),
        encodeFlushPktLine(),
      ]);

      const advertisement = yield* parseRefAdvertisement({
        content: concatBytes(packets),
      });

      assert.deepStrictEqual(
        advertisement.refs.map((ref) => String(ref.name)),
        ["HEAD", "refs/heads/main", "refs/heads/feature"],
      );
      assert.deepStrictEqual(advertisement.capabilities, [
        "multi_ack",
        "symref=HEAD:refs/heads/main",
        "side-band-64k",
        "ofs-delta",
      ]);
      assert.strictEqual(String(advertisement.headSymrefTarget), "refs/heads/main");
    }));

  it.effect("fails when flush packet is missing after service prelude", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({
          payload: encoder.encode("# service=git-upload-pack\n"),
        }),
        encodePktLine({
          payload: encoder.encode("1111111111111111111111111111111111111111 refs/heads/main\n"),
        }),
      ]);

      const error = yield* Effect.flip(
        parseRefAdvertisement({
          content: concatBytes(packets),
        }),
      );
      assert.strictEqual(error._tag, "RefAdvertisementParseError");
      if (error._tag === "RefAdvertisementParseError") {
        assert.strictEqual(error.reason._tag, "MissingServiceFlush");
      }
    }));

  it.effect("fails when prelude packet sequence is empty", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        parseRefAdvertisement({
          content: new Uint8Array(),
        }),
      );
      assert.strictEqual(error._tag, "RefAdvertisementParseError");
      if (error._tag === "RefAdvertisementParseError") {
        assert.strictEqual(error.reason._tag, "MissingServicePrelude");
      }
    }));

  it.effect("fails when capabilities appear after the first ref line", () =>
    Effect.gen(function*() {
      const packets = yield* Effect.all([
        encodePktLine({
          payload: encoder.encode("# service=git-upload-pack\n"),
        }),
        encodeFlushPktLine(),
        encodePktLine({
          payload: encoder.encode("1111111111111111111111111111111111111111 refs/heads/main\n"),
        }),
        encodePktLine({
          payload: encoder.encode("2222222222222222222222222222222222222222 refs/heads/feature\0ofs-delta\n"),
        }),
      ]);

      const error = yield* Effect.flip(
        parseRefAdvertisement({
          content: concatBytes(packets),
        }),
      );
      assert.strictEqual(error._tag, "RefAdvertisementParseError");
      if (error._tag === "RefAdvertisementParseError") {
        assert.strictEqual(error.reason._tag, "MalformedRefLine ");
      }
    }));
});
