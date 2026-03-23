import { type Effect, Schema, ServiceMap } from "effect";

import { EntryName, type FileMode, FilePath } from "../domain/models/object.ts";

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

export class EnsureWorkingTreeDirectoryFailed extends Schema.TaggedErrorClass<EnsureWorkingTreeDirectoryFailed>()(
  "EnsureWorkingTreeDirectoryFailed",
  {
    cause: Schema.Defect,
  },
) {}

export class WriteWorkingTreeFileFailed extends Schema.TaggedErrorClass<WriteWorkingTreeFileFailed>()(
  "WriteWorkingTreeFileFailed",
  {
    cause: Schema.Defect,
  },
) {}

export class UnsafeCheckoutPath extends Schema.TaggedErrorClass<UnsafeCheckoutPath>()("UnsafeCheckoutPath", {
  path: FilePath,
}) {}

export class UnsupportedFileType extends Schema.TaggedErrorClass<UnsupportedFileType>()("UnsupportedFileType", {
  type: Schema.String,
}) {}

export class WorkingTreeOutputPortError extends Schema.TaggedErrorClass<WorkingTreeOutputPortError>()(
  "WorkingTreeOutputPortError",
  {
    reason: Schema.Union([
      ReadWorkingTreeFileFailed,
      ListWorkingTreeEntriesFailed,
      EnsureWorkingTreeDirectoryFailed,
      WriteWorkingTreeFileFailed,
      UnsafeCheckoutPath,
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

export interface WorkingTreeOutputPortShape {
  readWorkingTreeFile: ({
    path,
  }: {
    path: FilePath;
  }) => Effect.Effect<Uint8Array<ArrayBuffer>, WorkingTreeOutputPortError, never>;

  listWorkingTreeEntries: ({
    path,
  }: {
    path: FilePath;
  }) => Effect.Effect<ReadonlyArray<WorkingTreeEntry>, WorkingTreeOutputPortError, never>;

  ensureWorkingTreeDirectory: ({
    path,
  }: {
    path: FilePath;
  }) => Effect.Effect<void, WorkingTreeOutputPortError, never>;

  writeWorkingTreeFile: ({
    path,
    content,
    mode,
  }: {
    path: FilePath;
    content: Uint8Array<ArrayBuffer>;
    mode: FileMode;
  }) => Effect.Effect<void, WorkingTreeOutputPortError, never>;
}

export class WorkingTreeOutputPort extends ServiceMap.Service<
  WorkingTreeOutputPort,
  WorkingTreeOutputPortShape
>()("app/ports/WorkingTreeOutputPort") {}
