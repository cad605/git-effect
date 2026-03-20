import { Schema } from "effect";

import { BlobObject } from "./blob-object.ts";
import { CommitObject } from "./commit-object.ts";
import { TreeObject } from "./tree-object.ts";

export const GitObject = Schema.Union([BlobObject, TreeObject, CommitObject]);

export type GitObject = typeof GitObject.Type;
