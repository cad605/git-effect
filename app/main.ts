import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, FileSystem, Terminal } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { unzipSync  } from "node:zlib";

const init = Command.make(
  "init",
  {},
  Effect.fn("git.init")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const { verbose } = yield* git;

    if (verbose) {
      yield* Effect.log("Initializing git directory...");
    }

    yield* fs.makeDirectory(".git", { recursive: true });
    yield* fs.makeDirectory(".git/objects", { recursive: true });
    yield* fs.makeDirectory(".git/refs", { recursive: true });
    yield* fs.writeFileString(".git/HEAD", "ref: refs/heads/main\n");

    if (verbose) {
      yield* Effect.log("Initialized git directory", { success: true });
    }
  }),
).pipe(
  Command.withAlias("i"),
  Command.withDescription("Initialize a new git repository"),
  Command.withExamples([
    {
      command: "git init",
      description: "Initialize a new git repository",
    },
  ]),
);

const catFile = Command.make(
  "cat-file",
  {
    pretty: Flag.boolean("pretty-print").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Pretty print the content of the Git object"),
    ),
    hash: Argument.string("hash").pipe(Argument.withDescription("Git Object SHA to cat")),
  },
  Effect.fn("git.cat-file")(function* ({ pretty, hash }) {
    const fs = yield* FileSystem.FileSystem;
    const terminal = yield* Terminal.Terminal

    const compressed = yield* fs.readFile(`.git/objects/${hash.slice(0, 2)}/${hash.slice(2)}`);

    const decompressed = unzipSync(compressed);

    const [_, content] = decompressed.toString("utf-8").split("\0");

    if (pretty) {
      yield* terminal.display(content);
    }
  }),
).pipe(
  Command.withDescription("View the type, size, and content of a Git object"),
  Command.withExamples([
    {
      command: "git cat-file -p <blob_sha>",
      description: "View the content of the Git Object identified by the provided SHA",
    },
  ]),
);

const git = Command.make("git").pipe(
  Command.withSharedFlags({
    verbose: Flag.boolean("verbose").pipe(
      Flag.withAlias("v"),
      Flag.withDescription("Print diagnostic output"),
    ),
  }),
  Command.withDescription("Git is a version control system."),
);

const program = Command.run(git.pipe(Command.withSubcommands([init, catFile])), {
  version: "1.0.0",
});

const appLayer = BunServices.layer;

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
