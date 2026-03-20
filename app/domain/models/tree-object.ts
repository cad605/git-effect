import { Effect, Encoding, Schema } from "effect";

import { EntryName } from "./entry-name.ts";
import { FileMode } from "./file-mode.ts";
import { ObjectHash } from "./object-hash.ts";
import { ObjectType } from "./object-type.ts";

export class TreeEntry extends Schema.Class<TreeEntry>("TreeEntry")({
  mode: FileMode,
  name: EntryName,
  hash: ObjectHash,
}) {
  readonly type =
    this.mode === "40000" ? ObjectType.makeUnsafe("tree") : ObjectType.makeUnsafe("blob");
}

export class TreeObject extends Schema.TaggedClass<TreeObject>()("TreeObject", {
  entries: Schema.Array(TreeEntry),
}) {
  static readonly serialize = Effect.fn("TreeObject.serialize")(function* (tree: TreeObject) {
    const entryBuffers = yield* Effect.forEach(
      tree.entries,
      Effect.fnUntraced(function* ({ mode, name, hash }) {
        const hashBytes = yield* Encoding.decodeHex(hash);

        return Buffer.concat([Buffer.from(`${mode} ${name}\0`), hashBytes]);
      }),
    );

    const body = Buffer.concat(entryBuffers);
    const header = Buffer.from(`tree ${body.length}\0`);

    return Buffer.concat([header, body]);
  });
}
