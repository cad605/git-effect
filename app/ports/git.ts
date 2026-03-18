import { Effect, ServiceMap } from "effect";

export type GitShape = {
  init: () => Effect.Effect<void, unknown>;
  catFile: (hash: string) => Effect.Effect<{ type: string; content: string }, unknown>;
};

export class Git extends ServiceMap.Service<Git, GitShape>()("app/ports/Git") {}
