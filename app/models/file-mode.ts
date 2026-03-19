import { Schema } from "effect";

export const FileMode = Schema.Literals(["100644", "100755", "120000", "40000"]).pipe(
  Schema.brand("FileMode"),
);

export type FileMode = typeof FileMode.Type;
