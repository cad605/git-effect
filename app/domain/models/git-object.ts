import { Schema } from "effect";

import { BlobObject } from "./blob-object.ts";
import { TreeObject } from "./tree-object.ts";

export const GitObject = Schema.Union([BlobObject, TreeObject]);

export type GitObject = typeof GitObject.Type;
