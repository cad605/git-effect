import { Array, Effect, FileSystem, Layer, Option, Schema, Stream } from "effect";

import { Compression } from "../ports/compression.ts";
import { Crypto } from "../ports/crypto.ts";
import { Git, GitError, TreeEntry } from "../ports/git.ts";

const readUntil = (buffer: Buffer, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);
  return [buffer.toString("utf-8", offset, idx), idx + 1] as const;
};

const readBytes = (buffer: Buffer, offset: number, length: number) => {
  return [buffer.subarray(offset, offset + length), offset + length] as const;
};

export const parseTreeEntries = Effect.fn("parseTreeEntries")(function* (buffer: Buffer) {
  const start = buffer.indexOf(0x00) + 1;

  const entries = Array.unfold(start, (offset) => {
    if (offset >= buffer.length) return Option.none();

    const [mode, afterMode] = readUntil(buffer, offset, 0x20);
    const [name, afterName] = readUntil(buffer, afterMode, 0x00);
    const [shaBytes, nextOffset] = readBytes(buffer, afterName, 20);

    return Option.some([{ mode, name, sha: shaBytes.toString("hex") }, nextOffset]);
  });

  return yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(entries);
});

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
        const compressed = yield* fs.readFile(`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`);

        const decompressed = yield* compression.unzip(Buffer.from(compressed));

        return yield* parseTreeEntries(decompressed);
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitError({ message: "Failed to list tree", cause });
        }),
      ),
    );

    const writeTree: (path: string) => Effect.Effect<string, GitError, never> = Effect.fn(
      "Git.writeTree",
    )(
      function* (path: string) {
        const directory = yield* fs.readDirectory(path);
        const sorted = directory.sort();

        const entries = yield* Stream.fromIterable(sorted).pipe(
          Stream.filter((name) => name !== ".git"),
          Stream.mapEffect((name) => {
            const fullPath = `${path}/${name}`;

            return Effect.gen(function* () {
              const { type } = yield* fs.stat(fullPath);

              if (type === "Directory") {
                const sha = yield* writeTree(fullPath);
                return { mode: "40000", name, sha };
              }

              const sha = yield* hashObject(fullPath, true);
              return { mode: "100644", name, sha };
            });
          }),
          Stream.runCollect,
        );

        const buffers = entries.map(({ mode, name, sha }) =>
          Buffer.concat([Buffer.from(`${mode} ${name}\0`), Buffer.from(sha, "hex")]),
        );
        const body = Buffer.concat(buffers);
        const header = Buffer.from(`tree ${body.length}\0`);
        const payload = Buffer.concat([header, body]);

        const hash = yield* crypto.hash(payload);
        const compressed = yield* compression.zip(payload);
        const prefix = hash.slice(0, 2);
        const suffix = hash.slice(2);

        yield* fs.makeDirectory(`.git/objects/${prefix}`, { recursive: true });
        yield* fs.writeFile(`.git/objects/${prefix}/${suffix}`, compressed);

        return hash;
      },

      Effect.catch(
        Effect.fn(function* (cause) {
          yield* Effect.logError(cause);

          return yield* new GitError({ message: "Failed to write tree", cause });
        }),
      ),
    );

    return Git.of({
      init,
      catFile,
      hashObject,
      listTree,
      writeTree,
    });
  }),
);
