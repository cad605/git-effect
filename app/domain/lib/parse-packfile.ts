import { Effect } from "effect";

import { PackfileParseError, PackObjectCountMismatch, TruncatedPackData } from "../errors/packfile-parse-error.ts";
import { type PackEntry, Packfile } from "../models/packfile.ts";
import { parsePackEntry } from "./parse-pack-entry.ts";
import { parsePackHeader } from "./parse-pack-header.ts";

const PACK_HEADER_LENGTH = 12;
const PACK_TRAILER_LENGTH = 20;

export const parsePackfile = Effect.fn("parsePackfile")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  const header = yield* parsePackHeader({ content });

  let offset = PACK_HEADER_LENGTH;
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

  return new Packfile({
    header,
    entries,
  });
});
