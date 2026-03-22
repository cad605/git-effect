import { Effect, Encoding, Schema } from "effect";
import { concatBytes } from "../utils/concat-bytes.ts";

const encoder = new TextEncoder();

export const FilePath = Schema.NonEmptyString.pipe(Schema.brand("FilePath"));

export type FilePath = typeof FilePath.Type;

export const FileMode = Schema.Literals(["100644", "100755", "120000", "40000"]).pipe(
  Schema.brand("FileMode"),
);

export type FileMode = typeof FileMode.Type;

export const ObjectHash = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{40}$/)),
  Schema.brand("ObjectHash"),
);

export type ObjectHash = typeof ObjectHash.Type;

export const EntryName = Schema.NonEmptyString.pipe(Schema.brand("EntryName"));

export type EntryName = typeof EntryName.Type;

export class BlobObject extends Schema.TaggedClass<BlobObject>()("BlobObject", {
  content: Schema.instanceOf(Uint8Array<ArrayBuffer>),
}) {
  static readonly serializeBody = Effect.fn("BlobObject.serializeBody")(function*(blob: BlobObject) {
    return blob.content;
  });
}

export class TreeEntry extends Schema.Class<TreeEntry>("TreeEntry")({
  mode: FileMode,
  name: EntryName,
  hash: ObjectHash,
}) {
  readonly type = this.mode === "40000" ? ObjectType.makeUnsafe("tree") : ObjectType.makeUnsafe("blob");
}

export class TreeObject extends Schema.TaggedClass<TreeObject>()("TreeObject", {
  entries: Schema.Array(TreeEntry),
}) {
  static readonly serializeBody = Effect.fn("TreeObject.serializeBody")(function*(tree: TreeObject) {
    const entryBuffers = yield* Effect.forEach(
      tree.entries,
      Effect.fnUntraced(function*({ mode, name, hash }) {
        const hashBytes = yield* Encoding.decodeHex(hash);

        return concatBytes([encoder.encode(`${mode} ${name}\0`), new Uint8Array(hashBytes)]);
      }),
    );

    return concatBytes(entryBuffers);
  });
}

export class CommitObject extends Schema.TaggedClass<CommitObject>()("CommitObject", {
  tree: ObjectHash,
  parents: Schema.Array(ObjectHash),
  author: Schema.String,
  committer: Schema.String,
  message: Schema.String,
}) {
  static readonly serializeBody = Effect.fn("CommitObject.serializeBody")(function*({
    tree,
    parents,
    author,
    committer,
    message,
  }: CommitObject) {
    const lines = [
      `tree ${tree}`,
      ...parents.map((parent) => `parent ${parent}`),
      `author ${author}`,
      `committer ${committer}`,
      "",
      `${message}\n`,
    ];

    return encoder.encode(lines.join("\n"));
  });
}

export const ObjectType = Schema.Literals(["tree", "blob", "commit"]).pipe(
  Schema.brand("ObjectType"),
);

export type ObjectType = typeof ObjectType.Type;

export const Object = Schema.Union([BlobObject, TreeObject, CommitObject]);

export type Object = typeof Object.Type;
