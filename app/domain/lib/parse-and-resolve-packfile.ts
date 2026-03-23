import { Effect } from "effect";

import type { ObjectHash } from "../models/object.ts";
import { ResolvedPackfile } from "../models/packfile.ts";
import { parsePackfile } from "./parse-packfile.ts";
import { type ResolvedBaseObject, resolvePackDeltas } from "./resolve-pack-deltas.ts";

export const parseAndResolvePackfile = Effect.fn("parseAndResolvePackfile")(function*({
  content,
  baseObjectsByHash,
}: {
  content: Uint8Array<ArrayBuffer>;
  baseObjectsByHash?: ReadonlyMap<ObjectHash, ResolvedBaseObject>;
}) {
  const { entries: parsedEntries, header } = yield* parsePackfile({ content });

  const entries = yield* resolvePackDeltas({
    entries: parsedEntries,
    ...(baseObjectsByHash ? { baseObjectsByHash } : {}),
  });

  return new ResolvedPackfile({
    header,
    entries,
  });
});
