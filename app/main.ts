import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, FileSystem } from "effect";
import { Command, Flag } from "effect/unstable/cli";

const init = Command.make(
  "init",
  {},
  Effect.fn("git.init")(function* ({}) {
    const fs = yield* FileSystem.FileSystem;
    const { verbose } = yield* git;

    const logger = Effect.logWithLevel(verbose ? "Debug" : "Info");

    yield* logger("Initializing git directory...");

    yield* fs.makeDirectory(".git", { recursive: true });
    yield* fs.makeDirectory(".git/objects", { recursive: true });
    yield* fs.makeDirectory(".git/refs", { recursive: true });
    yield* fs.writeFileString(".git/HEAD", "ref: refs/heads/main\n");

    yield* logger("Initialized git directory.");

    yield* logger("Initialized git directory", { success: true });
  }),
).pipe(
  Command.withAlias("init"),
  Command.withDescription("Initialize a new git repository"),
  Command.withExamples([
    {
      command: "git init",
      description: "Initialize a new git repository",
    },
  ]),
);

const git = Command.make("git").pipe(
  Command.withSharedFlags({
    verbose: Flag.boolean("verbose"),
  }),
  Command.withDescription("Git is a version control system."),
);

const program = Command.run(git.pipe(Command.withSubcommands([init])), {
  version: "1.0.0",
});

const appLayer = BunServices.layer;

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
