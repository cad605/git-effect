import { Schema } from "effect";

export const ObjectType = Schema.Literals(["tree", "blob"]).pipe(Schema.brand("ObjectType"));

export type ObjectType = typeof ObjectType.Type;
