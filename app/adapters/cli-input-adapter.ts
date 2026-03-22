import { Effect, Option, Terminal } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { FilePath, ObjectHash } from "../domain/models/object.ts";
import { GitInputPort } from "../ports/git-input-port.ts";

const decoder = new TextDecoder();

const init = Command.make(
  "init",
  {},
  Effect.fn("CliInputAdapter.init")(function*() {
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
  Effect.fn("CliInputAdapter.cat-file")(function*({ pretty, hash }) {
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Reading file...", { hash, pretty });

    const blob = yield* git.catFile({ hash: ObjectHash.makeUnsafe(hash) });

    yield* Effect.logDebug("Result...", { blob });

    if (pretty) {
      yield* terminal.display(decoder.decode(blob.content));
    }

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription("View the type, size, and content of an object"),
  Command.withExamples([
    {
      command: "git cat-file -p <blob_sha>",
      description: "View the content of the object identified by the provided SHA",
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
  Effect.fn("CliInputAdapter.hash-object")(function*({ write, path }) {
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Hashing object...", { write, path });

    const hash = yield* git.hashObject({ path: FilePath.makeUnsafe(path), write });

    yield* terminal.display(hash);

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription("Hash an object and optionally write it to the object storage"),
  Command.withExamples([
    {
      command: "git hash-object -w <content>",
      description: "Hash an object and write it to the object storage",
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
  Effect.fn("CliInputAdapter.ls-tree")(function*({ nameOnly, hash }) {
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Listing tree...", { nameOnly, hash });

    const { entries } = yield* git.listTree({ hash: ObjectHash.makeUnsafe(hash) });

    yield* Effect.forEach(
      entries,
      ({ mode, type, hash, name }) => {
        const line = nameOnly ? `${name}\n` : `${mode.padStart(6, "0")} ${type} ${hash}\t${name}\n`;

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
  Effect.fn("CliInputAdapter.write-tree")(function*({ path }) {
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Writing tree...", { path });

    const hash = yield* git.writeTree({ path: FilePath.makeUnsafe(path) });

    yield* terminal.display(hash);

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription("Create a tree object from the current state of the \"staging area\""),
  Command.withExamples([
    {
      command: "git write-tree",
      description: "Create a tree object from the current state of the \"staging area\"",
    },
  ]),
);

const commitTree = Command.make(
  "commit-tree",
  {
    tree: Argument.string("tree").pipe(Argument.withDescription("Tree object SHA")),
    parent: Flag.optional(
      Flag.string("parent").pipe(Flag.withAlias("p"), Flag.withDescription("Parent commit SHA")),
    ),
    message: Flag.string("message").pipe(
      Flag.withAlias("m"),
      Flag.withDescription("Commit message"),
    ),
  },
  Effect.fn("CliInputAdapter.commit-tree")(function*({ tree, parent, message }) {
    const git = yield* GitInputPort;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Commit tree...", { tree, parent, message });

    const parentHash = Option.getOrUndefined(parent);

    const hash = yield* git.commitTree({
      tree: ObjectHash.makeUnsafe(tree),
      parent: parentHash ? ObjectHash.makeUnsafe(parentHash) : undefined,
      message,
    });

    yield* terminal.display(hash);

    yield* Effect.logDebug("Done", { success: true });
  }),
).pipe(
  Command.withDescription("Create a commit object from a tree"),
  Command.withExamples([
    {
      command: "git commit-tree <tree_sha> -m <message>",
      description: "Create a root commit from the given tree",
    },
    {
      command: "git commit-tree <tree_sha> -p <parent_sha> -m <message>",
      description: "Create a commit with a parent",
    },
  ]),
);

const root = Command.make("git").pipe(Command.withDescription("Git is a version control system."));

export const CliInputAdapter = Command.run(
  root.pipe(Command.withSubcommands([init, catFile, hashObject, listTree, writeTree, commitTree])),
  {
    version: "1.0.0",
  },
);
