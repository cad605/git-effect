import { Schema, ServiceMap, type Effect } from "effect";

import type { FilePath } from "../models/file-path.ts";
import type { GitObject } from "../models/git-object.ts";
import type { ObjectHash } from "../models/object-hash.ts";
import type { TreeEntry } from "../models/tree-object.ts";

export class GitInputPortError extends Schema.TaggedErrorClass("GitInputPortError")(
  "GitInputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export type GitInputPortShape = {
  init: () => Effect.Effect<void, GitInputPortError, never>;
  catFile: (hash: ObjectHash) => Effect.Effect<GitObject, GitInputPortError, never>;
  hashObject: (
    path: FilePath,
    write: boolean,
  ) => Effect.Effect<ObjectHash, GitInputPortError, never>;
  listTree: (hash: ObjectHash) => Effect.Effect<ReadonlyArray<TreeEntry>, GitInputPortError, never>;
  writeTree: (path: FilePath) => Effect.Effect<ObjectHash, GitInputPortError, never>;
  commitTree: (input: {
    tree: ObjectHash;
    parent: ObjectHash | undefined;
    message: string;
  }) => Effect.Effect<ObjectHash, GitInputPortError, never>;
};

export class GitInputPort extends ServiceMap.Service<GitInputPort, GitInputPortShape>()(
  "app/application/ports/input/GitInputPort",
) {}
