import { type Effect, Schema, ServiceMap } from "effect";

import type { BlobObject, FilePath, ObjectHash, TreeObject } from "../domain/models/object.ts";
import type { UploadPackAdvertisement } from "../domain/models/transfer-protocol.ts";

export class InitFailed extends Schema.TaggedErrorClass<InitFailed>()("InitFailed", {
  cause: Schema.Defect,
}) {}

export class CatFileFailed extends Schema.TaggedErrorClass<CatFileFailed>()("CatFileFailed", {
  cause: Schema.Defect,
}) {}

export class NotBlobObject extends Schema.TaggedErrorClass<NotBlobObject>()("NotBlobObject", {
  actualType: Schema.String,
}) {}

export class HashObjectFailed extends Schema.TaggedErrorClass<HashObjectFailed>()("HashObjectFailed", {
  cause: Schema.Defect,
}) {}

export class ListTreeFailed extends Schema.TaggedErrorClass<ListTreeFailed>()("ListTreeFailed", {
  cause: Schema.Defect,
}) {}

export class NotTreeObject extends Schema.TaggedErrorClass<NotTreeObject>()("NotTreeObject", {
  actualType: Schema.String,
}) {}

export class WriteTreeFailed extends Schema.TaggedErrorClass<WriteTreeFailed>()("WriteTreeFailed", {
  cause: Schema.Defect,
}) {}

export class CommitTreeFailed extends Schema.TaggedErrorClass<CommitTreeFailed>()("CommitTreeFailed", {
  cause: Schema.Defect,
}) {}

export class CloneFailed extends Schema.TaggedErrorClass<CloneFailed>()("CloneFailed", {
  cause: Schema.Defect,
}) {}

export class GitInputPortError extends Schema.TaggedErrorClass<GitInputPortError>()("GitInputPortError", {
  reason: Schema.Union([
    InitFailed,
    CatFileFailed,
    NotBlobObject,
    HashObjectFailed,
    ListTreeFailed,
    NotTreeObject,
    WriteTreeFailed,
    CommitTreeFailed,
    CloneFailed,
  ]),
}) {}

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
  }) => Effect.Effect<UploadPackAdvertisement, GitInputPortError, never>;
}

export class GitInputPort extends ServiceMap.Service<GitInputPort, GitInputPortShape>()(
  "app/ports/input/GitInputPort",
) {}
