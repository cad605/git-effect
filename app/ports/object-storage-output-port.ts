import { Schema, ServiceMap, type Effect } from "effect";

import type { ObjectHash } from "../domain/models/object-hash.ts";

export class ObjectStorageOutputPortError extends Schema.TaggedErrorClass(
  "ObjectStorageOutputPortError",
)("ObjectStorageOutputPortError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export interface ObjectStorageOutputPortShape {
  init: () => Effect.Effect<void, ObjectStorageOutputPortError, never>;

  read: ({
    hash,
  }: {
    hash: ObjectHash;
  }) => Effect.Effect<Buffer, ObjectStorageOutputPortError, never>;

  write: ({
    hash,
    content,
  }: {
    hash: ObjectHash;
    content: Buffer;
  }) => Effect.Effect<void, ObjectStorageOutputPortError, never>;
}

export class ObjectStorageOutputPort extends ServiceMap.Service<
  ObjectStorageOutputPort,
  ObjectStorageOutputPortShape
>()("app/ports/ObjectStorageOutputPort") {}
