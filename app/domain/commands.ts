import { Effect, Terminal } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { Git } from "../ports/git.ts";

const init = Command.make(
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

const catFile = Command.make(
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

    const content = yield* git.catFile(hash);

    yield* Effect.logDebug("Result...", { content });

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

const hashObject = Command.make(
  "hash-object",
  {
    write: Flag.boolean("write").pipe(
      Flag.withAlias("w"),
      Flag.withDescription("Write the object to the .git/objects directory"),
    ),
    path: Argument.string("path").pipe(Argument.withDescription("The path to the git object file")),
  },
  Effect.fn("cli.hash-object")(function* ({ write, path }) {
    const git = yield* Git;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Hashing object...", { write, path });

    const hash = yield* git.hashObject(path, write);

    yield* terminal.display(hash);

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription("Hash an object and optionally write it to the object database"),
  Command.withExamples([
    {
      command: "git hash-object -w <content>",
      description: "Hash an object and write it to the object database",
    },
  ]),
);

const listTree = Command.make(
  "ls-tree",
  {
    nameOnly: Flag.boolean("name-only").pipe(
      Flag.withDescription("Only list the names of the objects"),
    ),
    hash: Argument.string("hash").pipe(Argument.withDescription("Git Object SHA to list")),
  },
  Effect.fn("cli.ls-tree")(function* ({ nameOnly, hash }) {
    const git = yield* Git;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Listing tree...", { nameOnly, hash });

    const tree = yield* git.listTree(hash);

    const lines = tree.map((entry) => {
      if (nameOnly) {
        return entry.name;
      }

      return `${entry.mode.padStart(6, "0")} ${entry.type} ${entry.sha}\t${entry.name}`;
    });

    yield* terminal.display(lines.join("\n") + "\n");

    yield* Effect.logDebug("Done", { success: true });
  }),
);

const parent = Command.make("git").pipe(
  Command.withSharedFlags({
    verbose: Flag.boolean("verbose").pipe(
      Flag.withAlias("v"),
      Flag.withDescription("Print diagnostic output"),
    ),
  }),
  Command.withDescription("Git is a version control system."),
);

export const program = Command.run(
  parent.pipe(Command.withSubcommands([init, catFile, hashObject, listTree])),
  {
    version: "1.0.0",
  },
);
