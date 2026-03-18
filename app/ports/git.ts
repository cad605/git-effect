import { Effect, Schema, ServiceMap } from "effect";

export class GitError extends Schema.TaggedErrorClass("GitError")("GitError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export type GitShape = {
  init: () => Effect.Effect<void, GitError, never>;
  catFile: (hash: string) => Effect.Effect<string, GitError, never>;
  hashObject: (path: string, write: boolean) => Effect.Effect<string, GitError, never>;
};

export class Git extends ServiceMap.Service<Git, GitShape>()("app/ports/Git") {}
