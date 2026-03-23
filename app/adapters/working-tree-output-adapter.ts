import { Array, Effect, FileSystem, Layer, Order, Path, Schema, pipe } from "effect";

import { EntryName, FilePath } from "../domain/models/object.ts";
import {
  EnsureWorkingTreeDirectoryFailed,
  ListWorkingTreeEntriesFailed,
  ReadWorkingTreeFileFailed,
  UnsafeCheckoutPath,
  UnsupportedFileType,
  WorkingTreeEntry,
  WorkingTreeEntryType,
  WorkingTreeOutputPort,
  WorkingTreeOutputPortError,
  type WorkingTreeOutputPortShape,
  WriteWorkingTreeFileFailed,
} from "../ports/working-tree-output-port.ts";
import { RepositoryContext } from "./repository-context.ts";

const SafeCheckoutPath = FilePath.pipe(
  Schema.check(Schema.isPattern(/^(?![\\/])(?!.*(?:^|[\\/])\.git(?:[\\/]|$))(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/)),
);

const assertCheckoutPathSafe = Effect.fn("WorkingTreeOutputAdapter.assertCheckoutPathSafe")(
  function*({ path: checkoutPath }: { path: FilePath }) {
    yield* Schema.decodeUnknownEffect(SafeCheckoutPath)(checkoutPath).pipe(
      Effect.mapError(
        () =>
          new WorkingTreeOutputPortError({
            reason: new UnsafeCheckoutPath({
              path: checkoutPath,
            }),
          }),
      ),
    );
  },
);

const makeImpl = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ctx = yield* RepositoryContext;

  const readWorkingTreeFile: WorkingTreeOutputPortShape["readWorkingTreeFile"] = Effect.fn(
    "WorkingTreeOutputAdapter.readWorkingTreeFile",
  )(
    function*({ path: filePath }) {
      const content = yield* fs.readFile(ctx.resolveWithinRoot(filePath));

      return new Uint8Array(content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new WorkingTreeOutputPortError({
          reason: new ReadWorkingTreeFileFailed({ cause }),
        });
      }),
    ),
  );

  const listWorkingTreeEntries: WorkingTreeOutputPortShape["listWorkingTreeEntries"] = Effect.fn(
    "WorkingTreeOutputAdapter.listWorkingTreeEntries",
  )(
    function*({ path: directoryPath }) {
      const rootedDirectoryPath = ctx.resolveWithinRoot(directoryPath);
      
      const entries = yield* fs.readDirectory(rootedDirectoryPath);

      return yield* pipe(
        entries,
        Array.filter((name) => name !== ".git"),
        Array.sort(Order.String),
        Effect.forEach(
          Effect.fnUntraced(function*(name) {
            const entryPath = FilePath.makeUnsafe(path.join(directoryPath, name));
            
            const rootedEntryPath = ctx.resolveWithinRoot(entryPath);

            const { type } = yield* fs.stat(rootedEntryPath);

            if (type !== "File" && type !== "Directory") {
              return yield* Effect.fail(
                new WorkingTreeOutputPortError({
                  reason: new UnsupportedFileType({ type }),
                }),
              );
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
        return yield* new WorkingTreeOutputPortError({
          reason: new ListWorkingTreeEntriesFailed({ cause }),
        });
      }),
    ),
  );

  const ensureWorkingTreeDirectory: WorkingTreeOutputPortShape["ensureWorkingTreeDirectory"] = Effect.fn(
    "WorkingTreeOutputAdapter.ensureWorkingTreeDirectory",
  )(
    function*({ path: directoryPath }) {
      yield* assertCheckoutPathSafe({ path: directoryPath });
      
      yield* fs.makeDirectory(ctx.resolveWithinRoot(directoryPath), { recursive: true });
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new WorkingTreeOutputPortError({
          reason: new EnsureWorkingTreeDirectoryFailed({ cause }),
        });
      }),
    ),
  );

  const writeWorkingTreeFile: WorkingTreeOutputPortShape["writeWorkingTreeFile"] = Effect.fn(
    "WorkingTreeOutputAdapter.writeWorkingTreeFile",
  )(
    function*({ path: filePath, content, mode }) {
      yield* assertCheckoutPathSafe({ path: filePath });
      
      const parentDirectory = FilePath.makeUnsafe(path.dirname(filePath));
      
      yield* assertCheckoutPathSafe({ path: parentDirectory });
      
      const rootedParentDirectory = ctx.resolveWithinRoot(parentDirectory);
      
      const rootedFilePath = ctx.resolveWithinRoot(filePath);

      yield* fs.makeDirectory(rootedParentDirectory, { recursive: true });

      yield* fs.writeFile(rootedFilePath, content);

      if (mode === "100755") {
        yield* fs.chmod(rootedFilePath, 0o755);
      } else {
        yield* fs.chmod(rootedFilePath, 0o644);
      }
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new WorkingTreeOutputPortError({
          reason: new WriteWorkingTreeFileFailed({ cause }),
        });
      }),
    ),
  );

  return {
    readWorkingTreeFile,
    listWorkingTreeEntries,
    ensureWorkingTreeDirectory,
    writeWorkingTreeFile,
  } satisfies WorkingTreeOutputPortShape;
});

export const WorkingTreeOutputAdapter = Layer.effect(WorkingTreeOutputPort, makeImpl);
