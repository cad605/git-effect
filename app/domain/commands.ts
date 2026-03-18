import { Effect, Terminal } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { Git } from "../ports/git.ts";

export const init = Command.make(
  "init",
  {},
  Effect.fn("cli.init")(function* () {
    const git = yield* Git;
    const { verbose } = yield* parent;


    if (verbose) {
      yield* Effect.log("Initializing git directory...");
    }

    yield* git.init();

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

export const catFile = Command.make(
  "cat-file",
  {
    pretty: Flag.boolean("pretty-print").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Pretty print the content of the Git object"),
    ),
    hash: Argument.string("hash").pipe(Argument.withDescription("Git Object SHA to cat")),
  },
  Effect.fn("cli.cat-file")(function* ({ pretty, hash }) {
    const git = yield* Git;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Reading file...", { hash, pretty });

    const { type, content } = yield* git.catFile(hash);

    yield* Effect.logDebug("Result...", { type, content });

    if (pretty) {
      yield* terminal.display(content);
    }

    yield* Effect.logDebug("Done", { success: true });
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

export const parent = Command.make("git").pipe(
  Command.withSharedFlags({
    verbose: Flag.boolean("verbose").pipe(
      Flag.withAlias("v"),
      Flag.withDescription("Print diagnostic output"),
    ),
  }),
  Command.withDescription("Git is a version control system."),
);

export const root = Command.run(parent.pipe(Command.withSubcommands([init, catFile])), {
  version: "1.0.0",
});
