import { Effect, Schema, SchemaGetter, ServiceMap } from "effect";

const TreeMode = Schema.Literals(["100644", "100755", "120000", "40000"]);

const TreeType = Schema.Literals(["tree", "blob"]);

const TreeEntryFrom = Schema.Struct({
  mode: TreeMode,
  name: Schema.String,
  sha: Schema.String,
});

const TreeEntryTo = Schema.Struct({
  mode: TreeMode,
  name: Schema.String,
  sha: Schema.String,
  type: TreeType,
});

export const TreeEntry = TreeEntryFrom.pipe(
  Schema.decodeTo(TreeEntryTo, {
    decode: SchemaGetter.transform((from) => ({
      ...from,
      type: from.mode === "40000" ? TreeType.makeUnsafe("tree") : TreeType.makeUnsafe("blob"),
    })),
    encode: SchemaGetter.transform(({ type: _, ...rest }) => rest),
  }),
);

export type TreeEntry = typeof TreeEntry.Type;

export class GitError extends Schema.TaggedErrorClass("GitError")("GitError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export type GitShape = {
  init: () => Effect.Effect<void, GitError, never>;
  catFile: (hash: string) => Effect.Effect<string, GitError, never>;
  hashObject: (path: string, write: boolean) => Effect.Effect<string, GitError, never>;
  listTree: (hash: string) => Effect.Effect<ReadonlyArray<TreeEntry>, GitError, never>;
  writeTree: (path: string) => Effect.Effect<string, GitError, never>;
};

export class Git extends ServiceMap.Service<Git, GitShape>()("app/ports/Git") {}
