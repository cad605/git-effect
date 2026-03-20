import { type Effect, Schema, ServiceMap } from "effect";

import { EntryName } from "../domain/models/entry-name.ts";
import { FilePath } from "../domain/models/file-path.ts";
import type { ObjectHash } from "../domain/models/object-hash.ts";

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
  }) => Effect.Effect<Buffer, RepositoryOutputPortError, never>;

  writeObject: ({
    hash,
    content,
  }: {
    hash: ObjectHash;
    content: Buffer;
  }) => Effect.Effect<void, RepositoryOutputPortError, never>;

  readWorkingTreeFile: ({
    path,
  }: {
    path: FilePath;
  }) => Effect.Effect<Buffer, RepositoryOutputPortError, never>;

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
