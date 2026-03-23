import { Effect } from "effect";

import { DeltaDependencyCycle, MissingDeltaBase, PackfileParseError } from "../errors/packfile-parse-error.ts";
import { ObjectType, type ObjectHash } from "../models/object.ts";
import {
  type PackEntry,
  ResolvedPackEntry,
} from "../models/packfile.ts";
import { hashObject } from "../utils/crypto.ts";
import { applyGitDelta } from "./apply-git-delta.ts";
import { encodeObject } from "./encode-object.ts";

export type ResolvedBaseObject = {
  type: ObjectType;
  body: Uint8Array<ArrayBuffer>;
};

const computeResolvedEntryHash = Effect.fn("computeResolvedEntryHash")(function*(entry: ResolvedPackEntry) {
  const content = yield* encodeObject({
    type: entry.type,
    body: entry.body,
  });

  return yield* hashObject({ content });
});

export const resolvePackDeltas = Effect.fn("resolvePackDeltas")(function*({
  entries,
  baseObjectsByHash,
}: {
  entries: ReadonlyArray<PackEntry>;
  baseObjectsByHash?: ReadonlyMap<ObjectHash, ResolvedBaseObject>;
}) {
  const pendingByOffset = new Map(entries.map((entry) => [entry.offset, entry]));
  const allEntriesByOffset = new Map(entries.map((entry) => [entry.offset, entry]));
  const resolvedByOffset = new Map<number, ResolvedPackEntry>();
  const resolvedByHash = new Map<string, ResolvedBaseObject>();

  baseObjectsByHash?.forEach((base, hash) => {
    resolvedByHash.set(hash, base);
  });

  while (pendingByOffset.size > 0) {
    let resolvedInPass = 0;

    for (const [offset, entry] of pendingByOffset) {
      if (entry.type !== "ofs-delta" && entry.type !== "ref-delta") {
        const resolved = new ResolvedPackEntry({
          offset: entry.offset,
          sourceType: entry.type,
          type: ObjectType.makeUnsafe(entry.type),
          body: entry.payload,
          baseOffset: entry.baseOffset,
          baseHash: entry.baseHash,
        });
        resolvedByOffset.set(offset, resolved);
        pendingByOffset.delete(offset);

        const resolvedHash = yield* computeResolvedEntryHash(resolved);
        resolvedByHash.set(resolvedHash, {
          type: resolved.type,
          body: resolved.body,
        });
        resolvedInPass += 1;
        continue;
      }

      if (entry.type === "ofs-delta") {
        if (entry.baseOffset === undefined) {
          return yield* Effect.fail(
            new PackfileParseError({
              reason: new MissingDeltaBase({
                detail: `ofs-delta entry at offset ${entry.offset} does not contain a base offset reference.`,
              }),
            }),
          );
        }

        const baseEntry = allEntriesByOffset.get(entry.baseOffset);
        if (!baseEntry) {
          return yield* Effect.fail(
            new PackfileParseError({
              reason: new MissingDeltaBase({
                detail: `ofs-delta entry at offset ${entry.offset} references missing base offset ${entry.baseOffset}.`,
              }),
            }),
          );
        }

        const baseResolved = resolvedByOffset.get(entry.baseOffset);
        if (!baseResolved) {
          continue;
        }

        const body = yield* applyGitDelta({
          base: baseResolved.body,
          delta: entry.payload,
        });
        const resolved = new ResolvedPackEntry({
          offset: entry.offset,
          sourceType: entry.type,
          type: baseResolved.type,
          body,
          baseOffset: entry.baseOffset,
          baseHash: entry.baseHash,
        });
        resolvedByOffset.set(offset, resolved);
        pendingByOffset.delete(offset);

        const resolvedHash = yield* computeResolvedEntryHash(resolved);
        resolvedByHash.set(resolvedHash, {
          type: resolved.type,
          body: resolved.body,
        });
        resolvedInPass += 1;
        continue;
      }

      if (entry.baseHash === undefined) {
        return yield* Effect.fail(
          new PackfileParseError({
            reason: new MissingDeltaBase({
              detail: `ref-delta entry at offset ${entry.offset} does not contain a base hash reference.`,
            }),
          }),
        );
      }

      const baseResolved = resolvedByHash.get(entry.baseHash);
      if (!baseResolved) {
        continue;
      }

      const body = yield* applyGitDelta({
        base: baseResolved.body,
        delta: entry.payload,
      });
      const resolved = new ResolvedPackEntry({
        offset: entry.offset,
        sourceType: entry.type,
        type: baseResolved.type,
        body,
        baseOffset: entry.baseOffset,
        baseHash: entry.baseHash,
      });
      resolvedByOffset.set(offset, resolved);
      pendingByOffset.delete(offset);

      const resolvedHash = yield* computeResolvedEntryHash(resolved);
      resolvedByHash.set(resolvedHash, {
        type: resolved.type,
        body: resolved.body,
      });
      resolvedInPass += 1;
    }

    if (resolvedInPass > 0) {
      continue;
    }

    const unresolved = [...pendingByOffset.values()];
    const unresolvedOfs = unresolved.find((entry) => entry.type === "ofs-delta");
    if (unresolvedOfs?.baseOffset !== undefined && !allEntriesByOffset.has(unresolvedOfs.baseOffset)) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MissingDeltaBase({
            detail: `ofs-delta entry at offset ${unresolvedOfs.offset} references missing base offset ${unresolvedOfs.baseOffset}.`,
          }),
        }),
      );
    }

    const unresolvedRef = unresolved.find((entry) => entry.type === "ref-delta");
    if (unresolvedRef?.baseHash !== undefined) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MissingDeltaBase({
            detail: `ref-delta entry at offset ${unresolvedRef.offset} references unresolved base hash ${unresolvedRef.baseHash}.`,
          }),
        }),
      );
    }

    return yield* Effect.fail(
      new PackfileParseError({
        reason: new DeltaDependencyCycle({
          detail: `Could not resolve ${pendingByOffset.size} pack entries due to cyclic or unsatisfied delta dependencies.`,
        }),
      }),
    );
  }

  return yield* Effect.forEach(entries, (entry) => {
    const resolved = resolvedByOffset.get(entry.offset);
    if (resolved) {
      return Effect.succeed(resolved);
    }

    return Effect.fail(
      new PackfileParseError({
        reason: new DeltaDependencyCycle({
          detail: `Resolved entry at offset ${entry.offset} is missing from result set.`,
        }),
      }),
    );
  });
});
