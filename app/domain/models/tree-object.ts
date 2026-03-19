import { Schema } from "effect";

import { TreeEntry } from "./tree-entry.ts";

export class TreeObject extends Schema.TaggedClass<TreeObject>()("TreeObject", {
  entries: Schema.Array(TreeEntry),
}) {}
