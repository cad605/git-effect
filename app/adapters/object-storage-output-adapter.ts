import { Effect, FileSystem, Layer, Path } from "effect";

import { parseObjectLoosePath } from "../domain/lib/parse-object-loose-path.ts";
import type { ObjectHash } from "../domain/models/object-hash.ts";
import {
  ObjectStorageOutputPort,
  ObjectStorageOutputPortError,
  type ObjectStorageOutputPortShape,
} from "../ports/object-storage-output-port.ts";

const makeImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const init: ObjectStorageOutputPortShape["init"] = Effect.fn("ObjectStorageOutputAdapter.init")(
    function* () {
      yield* fs.makeDirectory(path.resolve(path.join(".git", "objects")), { recursive: true });

      yield* fs.makeDirectory(path.resolve(path.join(".git", "refs")), { recursive: true });

      yield* fs.writeFileString(path.join(".git", "HEAD"), "ref: refs/heads/main\n");
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new ObjectStorageOutputPortError({
          message: "Failed to initialize object storage",
          cause,
        });
      }),
    ),
  );

  const read: ObjectStorageOutputPortShape["read"] = Effect.fn("ObjectStorageOutputAdapter.read")(
    function* ({ hash }) {
      const { prefix, suffix } = parseObjectLoosePath(hash);

      const file = yield* fs.readFile(path.join(".git", "objects", prefix, suffix));

      return Buffer.from(file);
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new ObjectStorageOutputPortError({ message: "Failed to read object", cause });
      }),
    ),
  );

  const write: ObjectStorageOutputPortShape["write"] = Effect.fn(
    "ObjectStorageOutputAdapter.write",
  )(
    function* ({ hash, content }) {
      const { prefix, suffix } = parseObjectLoosePath(hash);

      yield* fs.makeDirectory(path.join(".git", "objects", prefix), { recursive: true });

      yield* fs.writeFile(path.join(".git", "objects", prefix, suffix), content);
    },

    Effect.catch(
      Effect.fnUntraced(function* (cause) {
        return yield* new ObjectStorageOutputPortError({
          message: "Failed to write object",
          cause,
        });
      }),
    ),
  );

  return { init, read, write } satisfies ObjectStorageOutputPortShape;
});

export const ObjectStorageOutputAdapter = Layer.effect(ObjectStorageOutputPort, makeImpl);
