import { Schema } from "effect";

import { EntryName } from "./entry-name.ts";
import { FileMode } from "./file-mode.ts";
import { ObjectHash } from "./object-hash.ts";
import { ObjectType } from "./object-type.ts";

export class TreeEntry extends Schema.Class<TreeEntry>("TreeEntry")({
  mode: FileMode,
  name: EntryName,
  sha: ObjectHash,
  type: ObjectType,
}) {}
