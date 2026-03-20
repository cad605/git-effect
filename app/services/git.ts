import { Array, Effect, FileSystem, Layer, Match, Order, Path, pipe } from "effect";

import { parseGitObject } from "../lib/parse-git-object.ts";
import { BlobObject } from "../models/blob-object.ts";
import { CommitObject } from "../models/commit-object.ts";
import { EntryName } from "../models/entry-name.ts";
import { FileMode } from "../models/file-mode.ts";
import type { FilePath } from "../models/file-path.ts";
import { FilePath as FilePathSchema } from "../models/file-path.ts";
import type { ObjectHash } from "../models/object-hash.ts";
import { TreeEntry, TreeObject } from "../models/tree-object.ts";
import { CompressionOutputPort } from "../ports/compression-output-port.ts";
import { CryptoOutputPort } from "../ports/crypto-output-port.ts";
import { GitInputPort, GitInputPortError } from "../ports/git-input-port.ts";

const COMMIT_METADATA = "John Doe <john@example.com> 1234567890 +0000";

export const parseObjectHash = (hash: ObjectHash) => ({
  prefix: hash.slice(0, 2),
  suffix: hash.slice(2),
});

export const GitService = Layer.effect(
  GitInputPort,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const compression = yield* CompressionOutputPort;
    const crypto = yield* CryptoOutputPort;

    const init = Effect.fn("GitService.init")(
      function* () {
        yield* fs.makeDirectory(path.resolve(path.join(".git")), { recursive: true });
        yield* fs.makeDirectory(path.resolve(path.join(".git", "objects")), { recursive: true });
        yield* fs.makeDirectory(path.resolve(path.join(".git", "refs")), { recursive: true });
        yield* fs.writeFileString(path.join(".git", "HEAD"), "ref: refs/heads/main\n");
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          return yield* new GitInputPortError({ message: "Failed to initialize .git", cause });
        }),
      ),
    );

    const readObject = Effect.fn("GitService.readObject")(function* (objectHash: ObjectHash) {
      const { prefix, suffix } = parseObjectHash(objectHash);

      const bytes = yield* fs.readFile(path.join(".git", "objects", prefix, suffix));

      return Buffer.from(bytes);
    });

    const writeObject = Effect.fn("GitService.writeObject")(function* (
      objectHash: ObjectHash,
      bytes: Buffer,
    ) {
      const { prefix, suffix } = parseObjectHash(objectHash);

      yield* fs.makeDirectory(path.join(".git", "objects", prefix), { recursive: true });

      yield* fs.writeFile(path.join(".git", "objects", prefix, suffix), bytes);
    });

    const catFile = Effect.fn("GitService.catFile")(
      function* (objectHash: ObjectHash) {
        const compressed = yield* readObject(objectHash);

        const decompressed = yield* compression.unzip(compressed);

        return yield* parseGitObject(decompressed);
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          return yield* new GitInputPortError({ message: "Failed to cat file", cause });
        }),
      ),
    );

    const hashObject = Effect.fn("GitService.hashObject")(
      function* (filePath: FilePath, write: boolean) {
        const bytes = yield* fs.readFile(filePath);

        const payload = yield* BlobObject.serialize(
          new BlobObject({ content: Buffer.from(bytes) }),
        );

        const hash = yield* crypto.hash(payload);

        if (write) {
          const compressed = yield* compression.zip(payload);

          yield* writeObject(hash, compressed);
        }

        return hash;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          return yield* new GitInputPortError({ message: "Failed to hash object", cause });
        }),
      ),
    );

    const listTree = Effect.fn("GitService.listTree")(
      function* (objectHash: ObjectHash) {
        const compressed = yield* readObject(objectHash);

        const decompressed = yield* compression.unzip(compressed);

        const object = yield* parseGitObject(decompressed);

        return yield* Match.valueTags(object, {
          BlobObject: () =>
            Effect.fail(new GitInputPortError({ message: "not a tree object", cause: undefined })),
          TreeObject: ({ entries }) => Effect.succeed(entries),
          CommitObject: () =>
            Effect.fail(new GitInputPortError({ message: "not a tree object", cause: undefined })),
        });
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          return yield* new GitInputPortError({ message: "Failed to list tree", cause });
        }),
      ),
    );

    const writeTree: (path: FilePath) => Effect.Effect<ObjectHash, GitInputPortError, never> =
      Effect.fn("GitService.writeTree")(
        function* (directoryPath: FilePath) {
          const entries = yield* pipe(
            yield* fs.readDirectory(directoryPath),
            Array.filter((name) => name !== ".git"),
            Array.sort(Order.String),
            Effect.forEach(
              Effect.fnUntraced(function* (name) {
                const fullPath = FilePathSchema.makeUnsafe(path.join(directoryPath, name));

                const { type: fileType } = yield* fs.stat(fullPath);

                return yield* Match.value(fileType).pipe(
                  Match.when(
                    "File",
                    Effect.fnUntraced(function* () {
                      const blobHash = yield* hashObject(fullPath, true);

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
                      const treeHash = yield* writeTree(fullPath);

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

          const compressed = yield* compression.zip(payload);

          const treeHash = yield* crypto.hash(payload);

          yield* writeObject(treeHash, compressed);

          return treeHash;
        },

        Effect.catch(
          Effect.fn(function* (cause) {
            return yield* new GitInputPortError({ message: "Failed to write tree", cause });
          }),
        ),
      );

    const commitTree = Effect.fn("GitService.commitTree")(
      function* (input: { tree: ObjectHash; parent: ObjectHash | undefined; message: string }) {
        const commit = new CommitObject({
          tree: input.tree,
          parents: input.parent ? [input.parent] : [],
          author: COMMIT_METADATA,
          committer: COMMIT_METADATA,
          message: input.message,
        });

        const payload = yield* CommitObject.serialize(commit);

        const hash = yield* crypto.hash(payload);

        const compressed = yield* compression.zip(payload);

        yield* writeObject(hash, compressed);

        return hash;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          return yield* new GitInputPortError({ message: "Failed to commit tree", cause });
        }),
      ),
    );

    return GitInputPort.of({
      init,
      catFile,
      hashObject,
      listTree,
      writeTree,
      commitTree,
    });
  }),
);
