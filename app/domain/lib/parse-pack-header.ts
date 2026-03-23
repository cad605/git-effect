import { Effect } from "effect";

import {
  InvalidPackSignature,
  PackfileParseError,
  TruncatedPackData,
  UnsupportedPackVersion,
} from "../errors/packfile-parse-error.ts";
import { PackHeader } from "../models/packfile.ts";

const decoder = new TextDecoder();

const PACK_HEADER_LENGTH = 12;
const SUPPORTED_PACK_VERSIONS = new Set([2, 3]);

export const parsePackHeader = Effect.fn("parsePackHeader")(
  function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
    if (content.byteLength < PACK_HEADER_LENGTH) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new TruncatedPackData({
            detail:
              `Packfile is ${content.byteLength} bytes, expected at least ${PACK_HEADER_LENGTH} bytes for header.`,
          }),
        }),
      );
    }

    const signature = decoder.decode(content.subarray(0, 4));

    if (signature !== "PACK") {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new InvalidPackSignature({
            detail: `Expected 'PACK' signature, received '${signature}'.`,
          }),
        }),
      );
    }

    const view = new DataView(content.buffer, content.byteOffset, content.byteLength);

    const version = view.getUint32(4, false);

    if (!SUPPORTED_PACK_VERSIONS.has(version)) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new UnsupportedPackVersion({
            version,
          }),
        }),
      );
    }

    const objectCount = view.getUint32(8, false);

    return new PackHeader({
      version,
      objectCount,
    });
  },
);
