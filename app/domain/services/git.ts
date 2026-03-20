import { Array, Effect, FileSystem, Layer, Match, Order, Path, pipe } from "effect";

import { CompressionOutputPort } from "../../ports/compression-output-port.ts";
import { CryptoOutputPort } from "../../ports/crypto-output-port.ts";
import {
  GitInputPort,
  GitInputPortError,
  type GitInputPortShape,
} from "../../ports/git-input-port.ts";
import { ObjectStorageOutputPort } from "../../ports/object-storage-output-port.ts";
import { parseObjectFromBuffer } from "../lib/parse-object-from-buffer.ts";
import { BlobObject } from "../models/blob-object.ts";
import { CommitObject } from "../models/commit-object.ts";
import { EntryName } from "../models/entry-name.ts";
import { FileMode } from "../models/file-mode.ts";
import { FilePath } from "../models/file-path.ts";
import { FilePath as FilePathSchema } from "../models/file-path.ts";
import { TreeEntry, TreeObject } from "../models/tree-object.ts";

const INITIAL_COMMIT_METADATA = "John Doe <john@example.com> 1234567890 +0000";

const makeImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const compression = yield* CompressionOutputPort;
  const crypto = yield* CryptoOutputPort;
  const storage = yield* ObjectStorageOutputPort;

  const init = Effect.fn("GitService.init")(
    function* () {
      yield* storage.init();
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to initialize .git", cause });
      }),
    ),
  );

  const catFile: GitInputPortShape["catFile"] = Effect.fn("GitService.catFile")(
    function* ({ hash }) {
      const buffer = yield* compression.unzip({ content: yield* storage.read({ hash }) });

      return yield* parseObjectFromBuffer(buffer);
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to cat file", cause });
      }),
    ),
  );

  const hashObject: GitInputPortShape["hashObject"] = Effect.fn("GitService.hashObject")(
    function* ({ path, write }) {
      const content = yield* fs.readFile(path);

      const hash = yield* crypto.hash({ content: Buffer.from(content) });

      if (write) {
        yield* storage.write({
          hash,
          content: yield* compression.zip({ content: Buffer.from(content) }),
        });
      }

      return hash;
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to hash object", cause });
      }),
    ),
  );

  const listTree: GitInputPortShape["listTree"] = Effect.fn("GitService.listTree")(
    function* ({ hash }) {
      const content = yield* compression.unzip({ content: yield* storage.read({ hash }) });

      const object = yield* parseObjectFromBuffer(content);

      return yield* Match.valueTags(object, {
        BlobObject: () =>
          Effect.fail(new GitInputPortError({ message: "not a tree object", cause: undefined })),
        TreeObject: ({ entries }) => Effect.succeed(entries),
        CommitObject: () =>
          Effect.fail(new GitInputPortError({ message: "not a tree object", cause: undefined })),
      });
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to list tree", cause });
      }),
    ),
  );

  const writeTree: GitInputPortShape["writeTree"] = Effect.fn("GitService.writeTree")(
    function* ({ path: dirPath }) {
      const entries = yield* pipe(
        yield* fs.readDirectory(dirPath),
        Array.filter((name) => name !== ".git"),
        Array.sort(Order.String),
        Effect.forEach(
          Effect.fnUntraced(function* (name) {
            const fullPath = FilePathSchema.makeUnsafe(path.join(dirPath, name));

            const { type: fileType } = yield* fs.stat(fullPath);

            return yield* Match.value(fileType).pipe(
              Match.when(
                "File",
                Effect.fnUntraced(function* () {
                  const blobHash = yield* hashObject({
                    path: FilePath.makeUnsafe(fullPath),
                    write: true,
                  });

                  return new TreeEntry({
                    mode: FileMode.makeUnsafe("100644"),
                    name: EntryName.makeUnsafe(name),
                    hash: blobHash,
                  });
                }),
              ),
              Match.when(
                "Directory",
                Effect.fnUntraced(function* () {
                  const treeHash = yield* writeTree({ path: FilePath.makeUnsafe(fullPath) });

                  return new TreeEntry({
                    mode: FileMode.makeUnsafe("40000"),
                    name: EntryName.makeUnsafe(name),
                    hash: treeHash,
                  });
                }),
              ),
              Match.orElse(
                Effect.fn(function* (cause) {
                  return yield* new GitInputPortError({
                    message: `Unsupported file type: ${fileType}`,
                    cause,
                  });
                }),
              ),
            );
          }),
        ),
      );

      const payload = yield* TreeObject.serialize(new TreeObject({ entries }));

      const hash = yield* crypto.hash({ content: payload });

      yield* storage.write({ hash, content: yield* compression.zip({ content: payload }) });

      return hash;
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to write tree", cause });
      }),
    ),
  );

  const commitTree: GitInputPortShape["commitTree"] = Effect.fn("GitService.commitTree")(
    function* ({ tree, parent, message }) {
      const commit = new CommitObject({
        tree,
        parents: parent ? [parent] : [],
        author: INITIAL_COMMIT_METADATA,
        committer: INITIAL_COMMIT_METADATA,
        message,
      });

      const content = yield* CommitObject.serialize(commit);

      const hash = yield* crypto.hash({ content });

      yield* storage.write({ hash, content: yield* compression.zip({ content }) });

      return hash;
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to commit tree", cause });
      }),
    ),
  );

  return { init, catFile, hashObject, listTree, writeTree, commitTree } satisfies GitInputPortShape;
});

export const GitService = Layer.effect(GitInputPort, makeImpl);
