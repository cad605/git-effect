import { type Effect, Schema, ServiceMap } from "effect";

import type { FilePath } from "../domain/models/file-path.ts";
import type { ObjectHash } from "../domain/models/object-hash.ts";
import type { Object } from "../domain/models/object.ts";
import type { TreeObject } from "../domain/models/tree-object.ts";

export class GitInputPortError extends Schema.TaggedErrorClass("GitInputPortError")(
  "GitInputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export interface GitInputPortShape {
  init: () => Effect.Effect<void, GitInputPortError, never>;

  catFile: ({ hash }: { hash: ObjectHash }) => Effect.Effect<Object, GitInputPortError, never>;

  hashObject: ({
    path,
    write,
  }: {
    path: FilePath;
    write: boolean;
  }) => Effect.Effect<ObjectHash, GitInputPortError, never>;

  listTree: ({
    hash,
  }: {
    hash: ObjectHash;
  }) => Effect.Effect<TreeObject, GitInputPortError, never>;

  writeTree: ({ path }: { path: FilePath }) => Effect.Effect<ObjectHash, GitInputPortError, never>;

  commitTree: ({
    tree,
    parent,
    message,
  }: { tree: ObjectHash; parent: ObjectHash | undefined; message: string }) => Effect.Effect<
    ObjectHash,
    GitInputPortError,
    never
  >;
}

export class GitInputPort extends ServiceMap.Service<GitInputPort, GitInputPortShape>()(
  "app/ports/input/GitInputPort",
) {}
