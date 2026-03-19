import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Terminal } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { FilePath } from "./domain/models/file-path.ts";
import { ObjectHash } from "./domain/models/object-hash.ts";
import { GitLive } from "./ports/git.ts";
import { GitInputPort } from "./ports/git.ts";

const init = Command.make(
  "init",
  {},
  Effect.fn("cli.init")(function* () {
    const git = yield* GitInputPort;

    yield* git.init();
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
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Reading file...", { hash, pretty });

    const gitObject = yield* git.catFile(ObjectHash.makeUnsafe(hash));

    yield* Effect.logDebug("Result...", { gitObject });

    if (pretty) {
      switch (gitObject._tag) {
        case "BlobObject":
          yield* terminal.display(gitObject.content.toString());
          break;
        case "TreeObject":
          yield* Effect.forEach(
            gitObject.entries,
            ({ mode, type, sha, name }) => {
              const line = `${mode.padStart(6, "0")} ${type} ${sha}\t${name}\n`;
              return terminal.display(line);
            },
            { discard: true },
          );
          break;
      }
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
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Hashing object...", { write, path });

    const hash = yield* git.hashObject(FilePath.makeUnsafe(path), write);

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
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Listing tree...", { nameOnly, hash });

    const entries = yield* git.listTree(ObjectHash.makeUnsafe(hash));

    yield* Effect.forEach(
      entries,
      ({ mode, type, sha, name }) => {
        const line = nameOnly ? `${name}\n` : `${mode.padStart(6, "0")} ${type} ${sha}\t${name}\n`;

        return terminal.display(line);
      },
      { discard: true },
    );

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription("List the contents of a tree object"),
  Command.withExamples([
    {
      command: "git ls-tree <tree_sha>",
      description: "List the contents of a tree object given its SHA",
    },
  ]),
);

const writeTree = Command.make(
  "write-tree",
  {
    path: Argument.string("path").pipe(
      Argument.withDescription("The path to the tree object"),
      Argument.withDefault("."),
    ),
  },
  Effect.fn("cli.write-tree")(function* ({ path }) {
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Writing tree...", { path });

    const hash = yield* git.writeTree(FilePath.makeUnsafe(path));

    yield* terminal.display(hash);

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription('Create a tree object from the current state of the "staging area"'),
  Command.withExamples([
    {
      command: "git write-tree",
      description: 'Create a tree object from the current state of the "staging area"',
    },
  ]),
);

const root = Command.make("git").pipe(Command.withDescription("Git is a version control system."));

const program = Command.run(
  root.pipe(Command.withSubcommands([init, catFile, hashObject, listTree, writeTree])),
  {
    version: "1.0.0",
  },
);

program.pipe(Effect.provide(GitLive), Effect.provide(BunServices.layer), BunRuntime.runMain);
