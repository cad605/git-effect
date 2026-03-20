import { Effect, Layer, Match } from "effect";

import { CompressionOutputPort } from "../../ports/compression-output-port.ts";
import { CryptoOutputPort } from "../../ports/crypto-output-port.ts";
import {
  GitInputPort,
  GitInputPortError,
  type GitInputPortShape,
} from "../../ports/git-input-port.ts";
import { RepositoryOutputPort } from "../../ports/repository-output-port.ts";
import { parseRawObject } from "../lib/parse-raw-object.ts";
import { CommitObject } from "../models/commit-object.ts";
import { EntryName } from "../models/entry-name.ts";
import { FileMode } from "../models/file-mode.ts";
import { TreeEntry, TreeObject } from "../models/tree-object.ts";

const INITIAL_COMMIT_METADATA = "John Doe <john@example.com> 1234567890 +0000";

const makeImpl = Effect.gen(function* () {
  const compression = yield* CompressionOutputPort;
  const crypto = yield* CryptoOutputPort;
  const repository = yield* RepositoryOutputPort;

  const init = Effect.fn("GitService.init")(
    function* () {
      yield* repository.initRepository();
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to initialize .git", cause });
      }),
    ),
  );

  const catFile: GitInputPortShape["catFile"] = Effect.fn("GitService.catFile")(
    function* ({ hash }) {
      const buffer = yield* compression.unzip({ content: yield* repository.readObject({ hash }) });

      return yield* parseRawObject(buffer);
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to cat file", cause });
      }),
    ),
  );

  const hashObject: GitInputPortShape["hashObject"] = Effect.fn("GitService.hashObject")(
    function* ({ path, write }) {
      const content = yield* repository.readWorkingTreeFile({ path });

      const hash = yield* crypto.hash({ content });

      if (write) {
        yield* repository.writeObject({
          hash,
          content: yield* compression.zip({ content }),
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
      const content = yield* compression.unzip({ content: yield* repository.readObject({ hash }) });

      const object = yield* parseRawObject(content);

      if (object._tag !== "TreeObject") {
        return yield* Effect.fail(new Error("Not a tree object."));
      }

      return object.entries;
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new GitInputPortError({ message: "Failed to list tree", cause });
      }),
    ),
  );

  const writeTree: GitInputPortShape["writeTree"] = Effect.fn("GitService.writeTree")(
    function* ({ path: dirPath }) {
      const workingTreeEntries = yield* repository.listWorkingTreeEntries({ path: dirPath });

      const entries = yield* Effect.forEach(
        workingTreeEntries,
        Effect.fnUntraced(function* ({ name, path, type }) {
          return yield* Match.value(type).pipe(
            Match.when(
              "File",
              Effect.fnUntraced(function* () {
                const hash = yield* hashObject({
                  path,
                  write: true,
                });

                return new TreeEntry({
                  mode: FileMode.makeUnsafe("100644"),
                  name: EntryName.makeUnsafe(name),
                  hash,
                });
              }),
            ),

            Match.when(
              "Directory",
              Effect.fnUntraced(function* () {
                const hash = yield* writeTree({ path });

                return new TreeEntry({
                  mode: FileMode.makeUnsafe("40000"),
                  name: EntryName.makeUnsafe(name),
                  hash,
                });
              }),
            ),

            Match.exhaustive,
          );
        }),
      );

      const content = yield* TreeObject.serialize(new TreeObject({ entries }));

      const hash = yield* crypto.hash({ content });

      yield* repository.writeObject({ hash, content: yield* compression.zip({ content }) });

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

      yield* repository.writeObject({ hash, content: yield* compression.zip({ content }) });

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
