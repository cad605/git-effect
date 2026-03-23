import { type Effect, Schema, ServiceMap } from "effect";

import type { FilePath, ObjectHash } from "../domain/models/object.ts";
import type { RefName } from "../domain/models/transfer-protocol.ts";

export class SetRepositoryRootFailed
  extends Schema.TaggedErrorClass<SetRepositoryRootFailed>()("SetRepositoryRootFailed", {
    cause: Schema.Defect,
  })
{}

export class InitRepositoryFailed extends Schema.TaggedErrorClass<InitRepositoryFailed>()("InitRepositoryFailed", {
  cause: Schema.Defect,
}) {}

export class ReadObjectFailed extends Schema.TaggedErrorClass<ReadObjectFailed>()("ReadObjectFailed", {
  cause: Schema.Defect,
}) {}

export class WriteObjectFailed extends Schema.TaggedErrorClass<WriteObjectFailed>()("WriteObjectFailed", {
  cause: Schema.Defect,
}) {}

export class WriteRefFailed extends Schema.TaggedErrorClass<WriteRefFailed>()("WriteRefFailed", {
  cause: Schema.Defect,
}) {}

export class WriteHeadFailed extends Schema.TaggedErrorClass<WriteHeadFailed>()("WriteHeadFailed", {
  cause: Schema.Defect,
}) {}

export class ObjectStoreOutputPortError extends Schema.TaggedErrorClass<ObjectStoreOutputPortError>()(
  "ObjectStoreOutputPortError",
  {
    reason: Schema.Union([
      SetRepositoryRootFailed,
      InitRepositoryFailed,
      ReadObjectFailed,
      WriteObjectFailed,
      WriteRefFailed,
      WriteHeadFailed,
    ]),
  },
) {}

export interface ObjectStoreOutputPortShape {
  setRepositoryRoot: ({ path }: { path: FilePath }) => Effect.Effect<void, ObjectStoreOutputPortError, never>;

  initRepository: () => Effect.Effect<void, ObjectStoreOutputPortError, never>;

  readObject: ({
    hash,
  }: {
    hash: ObjectHash;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, ObjectStoreOutputPortError, never>;

  writeObject: ({
    hash,
    content,
  }: {
    hash: ObjectHash;
    content: Uint8Array<ArrayBuffer>;
  }) => Effect.Effect<void, ObjectStoreOutputPortError, never>;

  writeRef: ({
    ref,
    hash,
  }: {
    ref: RefName;
    hash: ObjectHash;
  }) => Effect.Effect<void, ObjectStoreOutputPortError, never>;

  writeHead: ({ ref }: { ref: RefName }) => Effect.Effect<void, ObjectStoreOutputPortError, never>;
}

export class ObjectStoreOutputPort extends ServiceMap.Service<
  ObjectStoreOutputPort,
  ObjectStoreOutputPortShape
>()("app/ports/ObjectStoreOutputPort") {}
