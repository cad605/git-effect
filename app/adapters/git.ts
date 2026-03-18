import { Effect, FileSystem, Layer, Schema } from "effect";

import { Compression } from "../ports/compression.ts";
import { Crypto } from "../ports/crypto.ts";
import { Git, GitError, TreeEntry } from "../ports/git.ts";

export const GitLive = Layer.effect(
  Git,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const compression = yield* Compression;
    const crypto = yield* Crypto;

    const init = Effect.fn("Git.init")(
      function* () {
        yield* fs.makeDirectory(".git", { recursive: true });
        yield* fs.makeDirectory(".git/objects", { recursive: true });
        yield* fs.makeDirectory(".git/refs", { recursive: true });
        yield* fs.writeFileString(".git/HEAD", "ref: refs/heads/main\n");
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitError({ message: "Failed to initialize .git", cause });
        }),
      ),
    );

    const catFile = Effect.fn("Git.catFile")(
      function* (hash: string) {
        const compressed = yield* fs.readFile(`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`);

        const decompressed = yield* compression.unzip(Buffer.from(compressed));

        const [_, content] = decompressed.toString("utf-8").split("\0");

        return content;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitError({ message: "Failed to cat file", cause });
        }),
      ),
    );

    const hashObject = Effect.fn("Git.hashObject")(
      function* (path: string, write: boolean) {
        const content = yield* fs.readFile(path);

        const header = Buffer.from(`blob ${content.length}\0`);
        const payload = Buffer.concat([header, content]);

        const hash = yield* crypto.hash(payload);

        if (write) {
          const compressed = yield* compression.zip(payload);
          const prefix = hash.slice(0, 2);
          const suffix = hash.slice(2);

          yield* fs.makeDirectory(`.git/objects/${prefix}`, { recursive: true });
          yield* fs.writeFile(`.git/objects/${prefix}/${suffix}`, compressed);
        }

        return hash;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitError({ message: "Failed to hash object", cause });
        }),
      ),
    );

    const listTree = Effect.fn("Git.listTree")(
      function* (hash: string) {
        const content = yield* fs.readFile(`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`);

        const decompressed = yield* compression.unzip(Buffer.from(content));

        let i = decompressed.indexOf(0) + 1;
        const entries = [];

        while (i < decompressed.length) {
          const spaceIdx = decompressed.indexOf(32, i);
          const mode = decompressed.toString("utf-8", i, spaceIdx);

          const nullIdx = decompressed.indexOf(0, spaceIdx + 1);
          const name = decompressed.toString("utf-8", spaceIdx + 1, nullIdx);

          const shaBuffer = decompressed.subarray(nullIdx + 1, nullIdx + 21);
          const sha = shaBuffer.toString("hex");

          entries.push({ mode, name, sha });

          i = nullIdx + 21;
        }

        return Schema.decodeUnknownSync(Schema.Array(TreeEntry))(entries);
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitError({ message: "Failed to list tree", cause });
        }),
      ),
    );

    return Git.of({
      init,
      catFile,
      hashObject,
      listTree,
    });
  }),
);
