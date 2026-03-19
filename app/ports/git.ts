import { Effect, FileSystem, Layer, Path, Schema, ServiceMap, Stream } from "effect";

import { unzip, zip } from "../domain/compression.ts";
import { sha1 } from "../domain/crypto.ts";
import { BlobObject } from "../domain/models/blob-object.ts";
import { EntryName } from "../domain/models/entry-name.ts";
import { FileMode } from "../domain/models/file-mode.ts";
import { FilePath } from "../domain/models/file-path.ts";
import type { GitObject } from "../domain/models/git-object.ts";
import type { ObjectHash } from "../domain/models/object-hash.ts";
import { ObjectType } from "../domain/models/object-type.ts";
import { TreeEntry } from "../domain/models/tree-entry.ts";
import { TreeObject } from "../domain/models/tree-object.ts";
import { parseObject, serializeBlob, serializeTree } from "../domain/objects.ts";

export class GitInputPortError extends Schema.TaggedErrorClass("GitInputPortError")(
  "GitInputPortError",
  {
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export type GitInputPortShape = {
  init: () => Effect.Effect<void, GitInputPortError, never>;
  catFile: (hash: ObjectHash) => Effect.Effect<GitObject, GitInputPortError, never>;
  hashObject: (
    path: FilePath,
    write: boolean,
  ) => Effect.Effect<ObjectHash, GitInputPortError, never>;
  listTree: (hash: ObjectHash) => Effect.Effect<ReadonlyArray<TreeEntry>, GitInputPortError, never>;
  writeTree: (path: FilePath) => Effect.Effect<ObjectHash, GitInputPortError, never>;
};

export class GitInputPort extends ServiceMap.Service<GitInputPort, GitInputPortShape>()(
  "app/ports/GitInputPort",
) {}

const objectPath = (hash: ObjectHash) => ({
  prefix: hash.slice(0, 2),
  suffix: hash.slice(2),
});

export const GitLive = Layer.effect(
  GitInputPort,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const init = Effect.fn("Git.init")(
      function* () {
        yield* fs.makeDirectory(path.resolve(path.join(".git")), { recursive: true });

        yield* fs.makeDirectory(path.resolve(path.join(".git", "objects")), { recursive: true });

        yield* fs.makeDirectory(path.resolve(path.join(".git", "refs")), { recursive: true });

        yield* fs.writeFileString(path.join(".git", "HEAD"), "ref: refs/heads/main\n");
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitInputPortError({ message: "Failed to initialize .git", cause });
        }),
      ),
    );

    const catFile = Effect.fn("Git.catFile")(
      function* (hash: ObjectHash) {
        const { prefix, suffix } = objectPath(hash);
        const bytes = yield* fs.readFile(path.join(".git", "objects", prefix, suffix));
        const compressed = Buffer.from(bytes);

        const decompressed = yield* unzip(compressed);

        return yield* parseObject(decompressed);
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitInputPortError({ message: "Failed to cat file", cause });
        }),
      ),
    );

    const hashObject = Effect.fn("Git.hashObject")(
      function* (filePath: FilePath, write: boolean) {
        const bytes = yield* fs.readFile(filePath);
        const content = Buffer.from(bytes);

        const blob = new BlobObject({ content });
        const payload = serializeBlob(blob);

        const hash = yield* sha1(payload);

        if (write) {
          const compressed = yield* zip(payload);

          const { prefix, suffix } = objectPath(hash);
          yield* fs.makeDirectory(path.join(".git", "objects", prefix), { recursive: true });
          yield* fs.writeFile(path.join(".git", "objects", prefix, suffix), compressed);
        }

        return hash;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitInputPortError({ message: "Failed to hash object", cause });
        }),
      ),
    );

    const listTree = Effect.fn("Git.listTree")(
      function* (hash: ObjectHash) {
        const { prefix, suffix } = objectPath(hash);
        const bytes = yield* fs.readFile(path.join(".git", "objects", prefix, suffix));
        const compressed = Buffer.from(bytes);

        const decompressed = yield* unzip(compressed);

        const gitObject = yield* parseObject(decompressed);

        if (gitObject._tag !== "TreeObject") {
          return yield* Effect.die(new Error(`Expected tree object, got ${gitObject._tag}`));
        }

        return gitObject.entries;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitInputPortError({ message: "Failed to list tree", cause });
        }),
      ),
    );

    const writeTree: (dirPath: FilePath) => Effect.Effect<ObjectHash, GitInputPortError, never> =
      Effect.fn("Git.writeTree")(
        function* (dirPath: FilePath) {
          const directory = yield* fs.readDirectory(dirPath);

          const entries = yield* Stream.fromIterable([...directory].sort()).pipe(
            Stream.filter((name) => name !== ".git"),
            Stream.mapEffect((name) => {
              const fullPath = FilePath.makeUnsafe(path.join(dirPath, name));

              return Effect.gen(function* () {
                const info = yield* fs.stat(fullPath);

                if (info.type === "Directory") {
                  const sha = yield* writeTree(fullPath);

                  return new TreeEntry({
                    mode: FileMode.makeUnsafe("40000"),
                    name: EntryName.makeUnsafe(name),
                    sha,
                    type: ObjectType.makeUnsafe("tree"),
                  });
                }

                const sha = yield* hashObject(fullPath, true);

                return new TreeEntry({
                  mode: FileMode.makeUnsafe("100644"),
                  name: EntryName.makeUnsafe(name),
                  sha,
                  type: ObjectType.makeUnsafe("blob"),
                });
              });
            }),
            Stream.runCollect,
          );

          const tree = new TreeObject({ entries: [...entries] });
          const payload = yield* serializeTree(tree);

          const hash = yield* sha1(payload);

          const compressed = yield* zip(payload);

          const { prefix, suffix } = objectPath(hash);
          yield* fs.makeDirectory(path.join(".git", "objects", prefix), { recursive: true });
          yield* fs.writeFile(path.join(".git", "objects", prefix, suffix), compressed);

          return hash;
        },

        Effect.catch(
          Effect.fn(function* (cause) {
            yield* Effect.logError(cause);

            return yield* new GitInputPortError({ message: "Failed to write tree", cause });
          }),
        ),
      );

    return GitInputPort.of({
      init,
      catFile,
      hashObject,
      listTree,
      writeTree,
    });
  }),
);
