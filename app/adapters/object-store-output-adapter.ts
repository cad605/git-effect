import { Effect, FileSystem, Layer, Path } from "effect";

import { splitObjectLoosePath } from "../domain/lib/split-object-loose-path.ts";
import {
  InitRepositoryFailed,
  ObjectStoreOutputPort,
  ObjectStoreOutputPortError,
  type ObjectStoreOutputPortShape,
  ReadObjectFailed,
  SetRepositoryRootFailed,
  WriteHeadFailed,
  WriteObjectFailed,
  WriteRefFailed,
} from "../ports/object-store-output-port.ts";
import { RepositoryContext } from "./repository-context.ts";

const makeImpl = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ctx = yield* RepositoryContext;

  const setRepositoryRoot: ObjectStoreOutputPortShape["setRepositoryRoot"] = Effect.fn(
    "ObjectStoreOutputAdapter.setRepositoryRoot",
  )(
    function*({ path: nextRoot }) {
      ctx.setRoot(nextRoot);

      yield* fs.makeDirectory(ctx.getRoot(), { recursive: true });
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new ObjectStoreOutputPortError({
          reason: new SetRepositoryRootFailed({ cause }),
        });
      }),
    ),
  );

  const initRepository: ObjectStoreOutputPortShape["initRepository"] = Effect.fn(
    "ObjectStoreOutputAdapter.initRepository",
  )(
    function*() {
      yield* fs.makeDirectory(ctx.resolveGitPath("objects"), { recursive: true });
      yield* fs.makeDirectory(ctx.resolveGitPath("refs"), { recursive: true });
      yield* fs.writeFileString(ctx.resolveGitPath("HEAD"), "ref: refs/heads/main\n");
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new ObjectStoreOutputPortError({
          reason: new InitRepositoryFailed({ cause }),
        });
      }),
    ),
  );

  const readObject: ObjectStoreOutputPortShape["readObject"] = Effect.fn(
    "ObjectStoreOutputAdapter.readObject",
  )(
    function*({ hash }) {
      const { prefix, suffix } = splitObjectLoosePath(hash);

      const content = yield* fs.readFile(ctx.resolveGitPath("objects", prefix, suffix));

      return new Uint8Array(content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new ObjectStoreOutputPortError({ reason: new ReadObjectFailed({ cause }) });
      }),
    ),
  );

  const writeObject: ObjectStoreOutputPortShape["writeObject"] = Effect.fn(
    "ObjectStoreOutputAdapter.writeObject",
  )(
    function*({ hash, content }) {
      const { prefix, suffix } = splitObjectLoosePath(hash);

      yield* fs.makeDirectory(ctx.resolveGitPath("objects", prefix), { recursive: true });

      yield* fs.writeFile(ctx.resolveGitPath("objects", prefix, suffix), content);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new ObjectStoreOutputPortError({ reason: new WriteObjectFailed({ cause }) });
      }),
    ),
  );

  const writeRef: ObjectStoreOutputPortShape["writeRef"] = Effect.fn(
    "ObjectStoreOutputAdapter.writeRef",
  )(
    function*({ ref, hash }) {
      const refPath = ctx.resolveGitPath(ref);

      yield* fs.makeDirectory(path.dirname(refPath), { recursive: true });
      
      yield* fs.writeFileString(refPath, `${hash}\n`);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new ObjectStoreOutputPortError({
          reason: new WriteRefFailed({ cause }),
        });
      }),
    ),
  );

  const writeHead: ObjectStoreOutputPortShape["writeHead"] = Effect.fn(
    "ObjectStoreOutputAdapter.writeHead",
  )(
    function*({ ref }) {
      yield* fs.writeFileString(ctx.resolveGitPath("HEAD"), `ref: ${ref}\n`);
    },
    Effect.catch(
      Effect.fnUntraced(function*(cause) {
        return yield* new ObjectStoreOutputPortError({
          reason: new WriteHeadFailed({ cause }),
        });
      }),
    ),
  );

  return {
    setRepositoryRoot,
    initRepository,
    readObject,
    writeObject,
    writeRef,
    writeHead,
  } satisfies ObjectStoreOutputPortShape;
});

export const ObjectStoreOutputAdapter = Layer.effect(ObjectStoreOutputPort, makeImpl);
