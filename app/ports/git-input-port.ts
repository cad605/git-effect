import { type Effect, Schema, ServiceMap } from "effect";

import type { BlobObject, FilePath, ObjectHash, TreeObject } from "../domain/models/object.ts";

export class GitInputPortError extends Schema.TaggedErrorClass("GitInputPortError")(
  "GitInputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export interface GitInputPortShape {
  init: () => Effect.Effect<void, GitInputPortError, never>;

  catFile: ({ hash }: { hash: ObjectHash }) => Effect.Effect<BlobObject, GitInputPortError, never>;

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

  clone: ({
    url,
  }: {
    url: string;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, GitInputPortError, never>;
}

export class GitInputPort extends ServiceMap.Service<GitInputPort, GitInputPortShape>()(
  "app/ports/input/GitInputPort",
) {}
