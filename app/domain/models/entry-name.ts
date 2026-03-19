import { Schema } from "effect";

export const EntryName = Schema.NonEmptyString.pipe(Schema.brand("EntryName"));

export type EntryName = typeof EntryName.Type;
