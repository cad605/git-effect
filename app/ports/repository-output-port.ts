import { type Effect, Schema, ServiceMap } from "effect";

import { EntryName, FilePath, type ObjectHash } from "../domain/models/object.ts";
import type { RefName } from "../domain/models/transfer-protocol.ts";

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

export class ReadWorkingTreeFileFailed extends Schema.TaggedErrorClass<ReadWorkingTreeFileFailed>()(
  "ReadWorkingTreeFileFailed",
  {
    cause: Schema.Defect,
  },
) {}

export class ListWorkingTreeEntriesFailed extends Schema.TaggedErrorClass<ListWorkingTreeEntriesFailed>()(
  "ListWorkingTreeEntriesFailed",
  {
    cause: Schema.Defect,
  },
) {}

export class UnsupportedFileType extends Schema.TaggedErrorClass<UnsupportedFileType>()("UnsupportedFileType", {
  type: Schema.String,
}) {}

export class RepositoryOutputPortError extends Schema.TaggedErrorClass<RepositoryOutputPortError>()(
  "RepositoryOutputPortError",
  {
    reason: Schema.Union([
      InitRepositoryFailed,
      ReadObjectFailed,
      WriteObjectFailed,
      WriteRefFailed,
      WriteHeadFailed,
      ReadWorkingTreeFileFailed,
      ListWorkingTreeEntriesFailed,
      UnsupportedFileType,
    ]),
  },
) {}

export const WorkingTreeEntryType = Schema.Literals(["File", "Directory"]).pipe(
  Schema.brand("WorkingTreeEntryType"),
);

export class WorkingTreeEntry extends Schema.Class<WorkingTreeEntry>("WorkingTreeEntry")({
  name: EntryName,
  path: FilePath,
  type: WorkingTreeEntryType,
}) {}

export interface RepositoryOutputPortShape {
  initRepository: () => Effect.Effect<void, RepositoryOutputPortError, never>;

  readObject: ({
    hash,
  }: {
    hash: ObjectHash;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, RepositoryOutputPortError, never>;

  writeObject: ({
    hash,
    content,
  }: {
    hash: ObjectHash;
    content: Uint8Array<ArrayBuffer>;
  }) => Effect.Effect<void, RepositoryOutputPortError, never>;

  writeRef: ({
    ref,
    hash,
  }: {
    ref: RefName;
    hash: ObjectHash;
  }) => Effect.Effect<void, RepositoryOutputPortError, never>;

  writeHead: ({ ref }: { ref: RefName }) => Effect.Effect<void, RepositoryOutputPortError, never>;

  readWorkingTreeFile: ({
    path,
  }: {
    path: FilePath;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, RepositoryOutputPortError, never>;

  listWorkingTreeEntries: ({
    path,
  }: {
    path: FilePath;
  }) => Effect.Effect<ReadonlyArray<WorkingTreeEntry>, RepositoryOutputPortError, never>;
}

export class RepositoryOutputPort extends ServiceMap.Service<
  RepositoryOutputPort,
  RepositoryOutputPortShape
>()("app/ports/RepositoryOutputPort") {}
