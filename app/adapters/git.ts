import { Effect, FileSystem, Layer } from "effect";

import { Compression } from "../ports/compression.ts";
import { Crypto } from "../ports/crypto.ts";
import { Git, GitError } from "../ports/git.ts";

export const GitLive = Layer.effect(
  Git,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const compression = yield* Compression;
    const crypto = yield* Crypto;

    // #region agent log
    yield* Effect.tryPromise(() => 
      fetch('http://127.0.0.1:7650/ingest/37fde57d-7485-45a9-b10d-4c7c9101b241',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'40abb1'},body:JSON.stringify({sessionId:'40abb1',runId:'run1',hypothesisId:'1,2,3',location:'app/adapters/git.ts:13',message:'compression properties',data:{keys:Object.keys(compression)},timestamp:Date.now()})}).catch(()=>{})
    );
    // #endregion

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

    return Git.of({
      init,
      catFile,
      hashObject,
    });
  }),
);
