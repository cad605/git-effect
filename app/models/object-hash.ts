import { Schema } from "effect";

export const ObjectHash = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{40}$/)),
  Schema.brand("ObjectHash"),
);

export type ObjectHash = typeof ObjectHash.Type;
