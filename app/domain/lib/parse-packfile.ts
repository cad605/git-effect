import { Effect } from "effect";

import {
  InvalidPackChecksum,
  InvalidPackEntryHeader,
  PackfileParseError,
  PackObjectCountMismatch,
  TruncatedPackData,
} from "../errors/packfile-parse-error.ts";
import { type PackEntry, Packfile } from "../models/packfile.ts";
import { hashRawSha1 } from "../utils/crypto.ts";
import { parsePackEntry } from "./parse-pack-entry.ts";
import { parsePackHeader } from "./parse-pack-header.ts";

const PACK_TRAILER_LENGTH = 20;

const areEqualBytes = (left: Uint8Array<ArrayBuffer>, right: Uint8Array<ArrayBuffer>) =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);

export const parsePackfile = Effect.fn("parsePackfile")(function*({
  content,
}: {
  content: Uint8Array<ArrayBuffer>;
}) {
  const header = yield* parsePackHeader({ content });

  let offset = 12;
  const entries: Array<PackEntry> = [];

  for (let index = 0; index < header.objectCount; index += 1) {
    const { entry, nextOffset } = yield* parsePackEntry({ content, offset });
    entries.push(entry);
    offset = nextOffset;
  }

  if (entries.length !== header.objectCount) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new PackObjectCountMismatch({
          expectedCount: header.objectCount,
          actualCount: entries.length,
        }),
      }),
    );
  }

  if (offset + PACK_TRAILER_LENGTH > content.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new TruncatedPackData({
          detail: `Missing ${PACK_TRAILER_LENGTH}-byte pack checksum trailer.`,
        }),
      }),
    );
  }

  const packChecksum = content.subarray(offset, offset + PACK_TRAILER_LENGTH);
  const computedChecksum = yield* hashRawSha1({ content: content.subarray(0, offset) }).pipe(
    Effect.mapError(
      (cause) =>
        new PackfileParseError({
          reason: new InvalidPackEntryHeader({
            detail: `Failed to compute pack checksum: ${String(cause)}`,
          }),
        }),
    ),
  );
  if (!areEqualBytes(packChecksum, computedChecksum)) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new InvalidPackChecksum({
          detail: "Pack checksum trailer does not match computed checksum.",
        }),
      }),
    );
  }

  return new Packfile({
    header,
    entries,
  });
});
