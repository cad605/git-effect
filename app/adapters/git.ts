import { Effect, FileSystem, Layer } from "effect";

import { Compression } from "../ports/compression.ts";
import { Git } from "../ports/git.ts";

export const GitLive = Layer.effect(
  Git,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const compression = yield* Compression;

    const init = Effect.fn("Git.init")(function* () {
      yield* fs.makeDirectory(".git", { recursive: true });
      yield* fs.makeDirectory(".git/objects", { recursive: true });
      yield* fs.makeDirectory(".git/refs", { recursive: true });
      yield* fs.writeFileString(".git/HEAD", "ref: refs/heads/main\n");
    });

    const catFile = Effect.fn("Git.catFile")(function* (hash: string) {
      const compressed = yield* fs.readFile(`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`);
      
      const decompressed = yield* compression.unzip(Buffer.from(compressed));

      const [type, content] = decompressed.toString("utf-8").split("\0");

      return { type, content };
    });

    return Git.of({
      init,
      catFile,
    });
  }),
);
