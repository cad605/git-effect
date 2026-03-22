import { Array, Effect, FileSystem, Layer, Order, Path, pipe } from "effect";

import { splitObjectLoosePath } from "../domain/lib/split-object-loose-path.ts";
import { EntryName, FilePath } from "../domain/models/object.ts";
import {
  RepositoryOutputPort,
  RepositoryOutputPortError,
  type RepositoryOutputPortShape,
  WorkingTreeEntry,
  WorkingTreeEntryType,
} from "../ports/repository-output-port.ts";

const makeImpl = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const initRepository: RepositoryOutputPortShape["initRepository"] = Effect.fn(
    "RepositoryOutputAdapter.initRepository",
  )(
    function*() {
      yield* fs.makeDirectory(path.resolve(path.join(".git", "objects")), { recursive: true });
      yield* fs.makeDirectory(path.resolve(path.join(".git", "refs")), { recursive: true });
      yield* fs.writeFileString(path.join(".git", "HEAD"), "ref: refs/heads/main\n");
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new RepositoryOutputPortError({
          message: "Failed to initialize repository storage",
          cause,
        });
      }),
    ),
  );

  const readObject: RepositoryOutputPortShape["readObject"] = Effect.fn(
    "RepositoryOutputAdapter.readObject",
  )(
    function*({ hash }) {
      const { prefix, suffix } = splitObjectLoosePath(hash);

      const content = yield* fs.readFile(path.join(".git", "objects", prefix, suffix));

      return new Uint8Array(content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new RepositoryOutputPortError({ message: "Failed to read object", cause });
      }),
    ),
  );

  const writeObject: RepositoryOutputPortShape["writeObject"] = Effect.fn(
    "RepositoryOutputAdapter.writeObject",
  )(
    function*({ hash, content }) {
      const { prefix, suffix } = splitObjectLoosePath(hash);

      yield* fs.makeDirectory(path.join(".git", "objects", prefix), { recursive: true });

      yield* fs.writeFile(path.join(".git", "objects", prefix, suffix), content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new RepositoryOutputPortError({ message: "Failed to write object", cause });
      }),
    ),
  );

  const readWorkingTreeFile: RepositoryOutputPortShape["readWorkingTreeFile"] = Effect.fn(
    "RepositoryOutputAdapter.readWorkingTreeFile",
  )(
    function*({ path }) {
      const content = yield* fs.readFile(path);

      return new Uint8Array(content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new RepositoryOutputPortError({
          message: "Failed to read working tree file",
          cause,
        });
      }),
    ),
  );

  const listWorkingTreeEntries: RepositoryOutputPortShape["listWorkingTreeEntries"] = Effect.fn(
    "RepositoryOutputAdapter.listWorkingTreeEntries",
  )(
    function*({ path: directoryPath }) {
      const entries = yield* fs.readDirectory(directoryPath);

      return yield* pipe(
        entries,
        Array.filter((name) => name !== ".git"),
        Array.sort(Order.String),
        Effect.forEach(
          Effect.fnUntraced(function*(name) {
            const entryPath = FilePath.makeUnsafe(path.join(directoryPath, name));

            const { type } = yield* fs.stat(entryPath);

            if (type !== "File" && type !== "Directory") {
              return yield* Effect.fail(new Error(`Unsupported file type: ${type}`));
            }

            return new WorkingTreeEntry({
              name: EntryName.makeUnsafe(name),
              path: entryPath,
              type: WorkingTreeEntryType.makeUnsafe(type),
            });
          }),
        ),
      );
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new RepositoryOutputPortError({
          message: "Failed to list working tree entries",
          cause,
        });
      }),
    ),
  );

  return {
    initRepository,
    readObject,
    writeObject,
    readWorkingTreeFile,
    listWorkingTreeEntries,
  } satisfies RepositoryOutputPortShape;
});

export const RepositoryOutputAdapter = Layer.effect(RepositoryOutputPort, makeImpl);
