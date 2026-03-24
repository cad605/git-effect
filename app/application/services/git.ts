import { Effect, Layer, Match, Stream } from "effect";

import { buildUploadPackRequest } from "../../domain/lib/build-upload-pack-request.ts";
import { decodeObject } from "../../domain/lib/decode-object.ts";
import { encodeObject } from "../../domain/lib/encode-object.ts";
import { parseAndResolvePackfile } from "../../domain/lib/parse-and-resolve-packfile.ts";
import { parseSidebandResponse } from "../../domain/lib/parse-sideband-response.ts";
import {
  BlobObject,
  CommitObject,
  EntryName,
  FileMode,
  FilePath,
  ObjectType,
  TreeEntry,
  TreeObject,
} from "../../domain/models/object.ts";
import type { ObjectHash } from "../../domain/models/object.ts";
import { unzip, zip } from "../../domain/utils/compression.ts";
import { hashObject as hashObjectContent } from "../../domain/utils/crypto.ts";
import {
  CatFileFailed,
  CheckoutFailed,
  CloneFailed,
  CloneTargetNotFound,
  CommitTreeFailed,
  GitInputPort,
  GitInputPortError,
  type GitInputPortShape,
  HashObjectFailed,
  InitFailed,
  ListTreeFailed,
  LsRemoteFailed,
  NotBlobObject,
  NotCommitObject,
  NotTreeObject,
  UnpackObjectsFailed,
  WriteTreeFailed,
} from "../../ports/git-input-port.ts";
import { ObjectStoreOutputPort } from "../../ports/object-store-output-port.ts";
import { TransferProtocolOutputPort } from "../../ports/transfer-protocol-output-port.ts";
import { WorkingTreeOutputPort } from "../../ports/working-tree-output-port.ts";

const INITIAL_COMMIT_METADATA = "John Doe <john@example.com> 1234567890 +0000";

const makeImpl = Effect.gen(function*() {
  const transferProtocol = yield* TransferProtocolOutputPort;
  const objectStore = yield* ObjectStoreOutputPort;
  const workingTree = yield* WorkingTreeOutputPort;

  const decodeStoredObject = Effect.fn("GitService.decodeStoredObject")(function*({ hash }: { hash: ObjectHash }) {
    const compressed = yield* objectStore.readObject({ hash });

    const content = yield* unzip({ content: compressed });

    return yield* decodeObject({ content });
  });

  const init: GitInputPortShape["init"] = Effect.fn("GitService.init")(
    function*() {
      yield* objectStore.initRepository();
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new InitFailed({ cause }) });
      }),
    ),
  );

  const catFile: GitInputPortShape["catFile"] = Effect.fn("GitService.catFile")(
    function*({ hash }) {
      const compressed = yield* objectStore.readObject({ hash });

      const rawObject = yield* unzip({ content: compressed });

      const { body } = yield* decodeObject({ content: rawObject });

      if (body._tag !== "BlobObject") {
        return yield* Effect.fail(new GitInputPortError({ reason: new NotBlobObject({ actualType: body._tag }) }));
      }

      return body;
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new CatFileFailed({ cause }) });
      }),
    ),
  );

  const hashObject: GitInputPortShape["hashObject"] = Effect.fn("GitService.hashObject")(
    function*({ path, write }) {
      const uncompressedContent = yield* workingTree.readWorkingTreeFile({ path });

      const blob = new BlobObject({ content: uncompressedContent });

      const body = yield* BlobObject.serializeBody(blob);

      const content = encodeObject({ type: ObjectType.makeUnsafe("blob"), body });

      const hash = yield* hashObjectContent({ content });

      if (write) {
        yield* objectStore.writeObject({
          hash,
          content: yield* zip({ content }),
        });
      }

      return hash;
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new HashObjectFailed({ cause }) });
      }),
    ),
  );

  const listTree: GitInputPortShape["listTree"] = Effect.fn("GitService.listTree")(
    function*({ hash }) {
      const compressed = yield* objectStore.readObject({ hash });

      const content = yield* unzip({ content: compressed });

      const { body } = yield* decodeObject({ content });

      if (body._tag !== "TreeObject") {
        return yield* Effect.fail(new GitInputPortError({ reason: new NotTreeObject({ actualType: body._tag }) }));
      }

      return body;
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new ListTreeFailed({ cause }) });
      }),
    ),
  );

  const writeTree: GitInputPortShape["writeTree"] = Effect.fn("GitService.writeTree")(
    function*({ path: dirPath }) {
      const workingTreeEntries = yield* workingTree.listWorkingTreeEntries({ path: dirPath });

      const entries = yield* Effect.forEach(
        workingTreeEntries,
        Effect.fnUntraced(function*({ name, path, type }) {
          return yield* Match.value(type).pipe(
            Match.when(
              "File",
              Effect.fnUntraced(function*() {
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
              Effect.fnUntraced(function*() {
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

      const body = yield* TreeObject.serializeBody(new TreeObject({ entries }));

      const content = encodeObject({ type: ObjectType.makeUnsafe("tree"), body });

      const hash = yield* hashObjectContent({ content });

      yield* objectStore.writeObject({ hash, content: yield* zip({ content }) });

      return hash;
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new WriteTreeFailed({ cause }) });
      }),
    ),
  );

  const commitTree: GitInputPortShape["commitTree"] = Effect.fn("GitService.commitTree")(
    function*({ tree, parent, message }) {
      const commit = new CommitObject({
        tree,
        parents: parent ? [parent] : [],
        author: INITIAL_COMMIT_METADATA,
        committer: INITIAL_COMMIT_METADATA,
        message,
      });

      const body = yield* CommitObject.serializeBody(commit);

      const content = encodeObject({ type: ObjectType.makeUnsafe("commit"), body });

      const hash = yield* hashObjectContent({ content });

      yield* objectStore.writeObject({ hash, content: yield* zip({ content }) });

      return hash;
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new CommitTreeFailed({ cause }) });
      }),
    ),
  );

  const lsRemote: GitInputPortShape["lsRemote"] = Effect.fn("GitService.lsRemote")(
    function*({ url }) {
      return yield* transferProtocol.discoverUploadPackRefs({ url });
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new LsRemoteFailed({ cause }) });
      }),
    ),
  );

  const unpackObjects: GitInputPortShape["unpackObjects"] = Effect.fn("GitService.unpackObjects")(
    function*({ packBytes }) {
      const { entries } = yield* parseAndResolvePackfile({
        content: packBytes,
      });

      yield* Effect.forEach(
        entries,
        Effect.fnUntraced(function*({ type, body }) {
          const content = encodeObject({ type, body });

          const hash = yield* hashObjectContent({ content });

          const compressedContent = yield* zip({ content });

          yield* objectStore.writeObject({ hash, content: compressedContent });
        }),
      );
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new UnpackObjectsFailed({ cause }) });
      }),
    ),
  );

  const checkout: GitInputPortShape["checkout"] = Effect.fn("GitService.checkout")(
    function*({ commit: commitHash }) {
      const { body: commit } = yield* decodeStoredObject({ hash: commitHash });

      if (commit._tag !== "CommitObject") {
        return yield* Effect.fail(new GitInputPortError({ reason: new NotCommitObject({ actualType: commit._tag }) }));
      }

      const queue: Array<{ treeHash: ObjectHash; parentPath: FilePath }> = [{ treeHash: commit.tree, parentPath: FilePath.makeUnsafe(".") }];

      while (queue.length > 0) {
        const current = queue.pop();

        if (!current) {
          continue;
        }

        const { body } = yield* decodeStoredObject({ hash: current.treeHash });

        if (body._tag !== "TreeObject") {
          return yield* Effect.fail(new GitInputPortError({ reason: new NotTreeObject({ actualType: body._tag }) }));
        }

        yield* Effect.forEach(
          body.entries,
          Effect.fnUntraced(function*(entry) {
            const entryPath = FilePath.makeUnsafe(current.parentPath === "." ? entry.name : `${current.parentPath}/${entry.name}`);

            if (entry.mode === "40000") {
              yield* workingTree.ensureWorkingTreeDirectory({ path: entryPath });
              
              queue.push({ treeHash: entry.hash, parentPath: entryPath });

              return;
            }

            const { body: blob } = yield* decodeStoredObject({ hash: entry.hash });

            if (blob._tag !== "BlobObject") {
              return yield* Effect.fail(
                new GitInputPortError({ reason: new NotBlobObject({ actualType: blob._tag }) }),
              );
            }

            yield* workingTree.writeWorkingTreeFile({
              path: entryPath,
              content: blob.content,
              mode: entry.mode,
            });
          }),
          { discard: true },
        );
      }
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new CheckoutFailed({ cause }) });
      }),
    ),
  );

  const clone: GitInputPortShape["clone"] = ({ url, destination }) =>
    Stream.unwrap(
      Effect.gen(function*() {
        yield* objectStore.setRepositoryRoot({ path: destination });

        yield* objectStore.initRepository();

        const advertisement = yield* lsRemote({ url });

        const targetRef = advertisement.refs.find((ref) => ref.name === advertisement.headSymrefTarget);
        const targetHash = targetRef?.hash;

        if (!targetRef || !targetHash) {
          return yield* Effect.fail(
            new GitInputPortError({
              reason: new CloneTargetNotFound({
                detail:
                  "Could not resolve a target commit from advertised refs. Expected HEAD symref, refs/heads/main, refs/heads/master, or any heads ref.",
              }),
            }),
          );
        }

        const requestBody = yield* buildUploadPackRequest({
          targetHash,
          serverCapabilities: advertisement.capabilities,
        });

        const uploadPackStream = yield* transferProtocol.requestUploadPack({
          url,
          body: requestBody,
        });

        const { progressStream, packBytes } = yield* parseSidebandResponse({
          content: uploadPackStream,
        });

        return Stream.concat(
          progressStream,
          Stream.fromEffectDrain(
            Effect.gen(function*() {
              yield* unpackObjects({ packBytes: yield* packBytes });

              yield* objectStore.writeRef({
                ref: targetRef.name,
                hash: targetHash,
              });

              yield* objectStore.writeHead({
                ref: targetRef.name,
              });

              yield* checkout({ commit: targetHash });
            }),
          ),
        );
      }),
    ).pipe(
      Stream.mapError(
        (cause) =>
          new GitInputPortError({ reason: new CloneFailed({ cause }) }),
      ),
    );

  return {
    init,
    catFile,
    hashObject,
    listTree,
    writeTree,
    commitTree,
    lsRemote,
    unpackObjects,
    checkout,
    clone,
  } satisfies GitInputPortShape;
});

export const GitService = Layer.effect(GitInputPort, makeImpl);
