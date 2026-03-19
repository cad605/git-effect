import { Effect, Schema } from "effect";

import { ObjectHash } from "./object-hash.ts";

export class CommitObject extends Schema.TaggedClass<CommitObject>()("CommitObject", {
  tree: ObjectHash,
  parents: Schema.Array(ObjectHash),
  author: Schema.String,
  committer: Schema.String,
  message: Schema.String,
}) {
  static formatBody({ tree, parents, author, committer, message }: CommitObject): string {
    const lines = [
      `tree ${tree}`,
      ...parents.map((parent) => `parent ${parent}`),
      `author ${author}`,
      `committer ${committer}`,
      "",
      `${message}\n`,
    ];

    return lines.join("\n");
  }

  static readonly serialize = Effect.fn("CommitObject.serialize")(function* (commit: CommitObject) {
    const body = Buffer.from(CommitObject.formatBody(commit), "utf8");
    const header = Buffer.from(`commit ${body.length}\0`);

    return Buffer.concat([header, body]);
  });
}
