import { Effect, Layer, Match } from "effect";

import { buildUploadPackRequest } from "../../domain/lib/build-upload-pack-request.ts";
import { decodeObject } from "../../domain/lib/decode-object.ts";
import { encodeObject } from "../../domain/lib/encode-object.ts";
import { parseSidebandResponse } from "../../domain/lib/parse-sideband-response.ts";
import {
  BlobObject,
  CommitObject,
  EntryName,
  FileMode,
  ObjectType,
  TreeEntry,
  TreeObject,
} from "../../domain/models/object.ts";
import { CompressionOutputPort } from "../../ports/compression-output-port.ts";
import { CryptoOutputPort } from "../../ports/crypto-output-port.ts";
import {
  CatFileFailed,
  CloneFailed,
  CloneTargetNotFound,
  CommitTreeFailed,
  GitInputPort,
  GitInputPortError,
  type GitInputPortShape,
  HashObjectFailed,
  InitFailed,
  ListTreeFailed,
  NotBlobObject,
  NotTreeObject,
  WriteTreeFailed,
} from "../../ports/git-input-port.ts";
import { RepositoryOutputPort } from "../../ports/repository-output-port.ts";
import { TransferProtocolOutputPort } from "../../ports/transfer-protocol-output-port.ts";

const INITIAL_COMMIT_METADATA = "John Doe <john@example.com> 1234567890 +0000";

const makeImpl = Effect.gen(function*() {
  const compression = yield* CompressionOutputPort;
  const crypto = yield* CryptoOutputPort;
  const transferProtocol = yield* TransferProtocolOutputPort;
  const repository = yield* RepositoryOutputPort;

  const init = Effect.fn("GitService.init")(
    function*() {
      yield* repository.initRepository();
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new InitFailed({ cause }) });
      }),
    ),
  );

  const catFile: GitInputPortShape["catFile"] = Effect.fn("GitService.catFile")(
    function*({ hash }) {
      const compressed = yield* repository.readObject({ hash });

      const rawObject = yield* compression.unzip({ content: compressed });

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
      const uncompressedContent = yield* repository.readWorkingTreeFile({ path });

      const blob = new BlobObject({ content: uncompressedContent });

      const body = yield* BlobObject.serializeBody(blob);

      const content = yield* encodeObject({ type: ObjectType.makeUnsafe("blob"), body });

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
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new HashObjectFailed({ cause }) });
      }),
    ),
  );

  const listTree: GitInputPortShape["listTree"] = Effect.fn("GitService.listTree")(
    function*({ hash }) {
      const compressed = yield* repository.readObject({ hash });

      const content = yield* compression.unzip({ content: compressed });

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
      const workingTreeEntries = yield* repository.listWorkingTreeEntries({ path: dirPath });

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

      const content = yield* encodeObject({ type: ObjectType.makeUnsafe("tree"), body });

      const hash = yield* crypto.hash({ content });

      yield* repository.writeObject({ hash, content: yield* compression.zip({ content }) });

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

      const content = yield* encodeObject({ type: ObjectType.makeUnsafe("commit"), body });

      const hash = yield* crypto.hash({ content });

      yield* repository.writeObject({ hash, content: yield* compression.zip({ content }) });

      return hash;
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({ reason: new CommitTreeFailed({ cause }) });
      }),
    ),
  );

  const clone: GitInputPortShape["clone"] = Effect.fn("GitService.clone")(
    function*({ url }) {
      const advertisement = yield* transferProtocol.discoverUploadPackRefs({ url });

      const targetHash = advertisement.refs.find((ref) => ref.name === advertisement.headSymrefTarget)?.hash;

      if (!targetHash) {
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

      const uploadPackResponse = yield* transferProtocol.requestUploadPack({
        url,
        body: requestBody,
      });

      return yield* parseSidebandResponse({ content: uploadPackResponse });
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new GitInputPortError({
          reason: new CloneFailed({
            cause,
          }),
        });
      }),
    ),
  );

  return { init, catFile, hashObject, listTree, writeTree, commitTree, clone } satisfies GitInputPortShape;
});

export const GitService = Layer.effect(GitInputPort, makeImpl);
