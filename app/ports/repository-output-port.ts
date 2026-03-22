import { type Effect, Schema, ServiceMap } from "effect";

import { EntryName, FilePath, type ObjectHash } from "../domain/models/object.ts";

export class RepositoryOutputPortError extends Schema.TaggedErrorClass("RepositoryOutputPortError")(
  "RepositoryOutputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
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
