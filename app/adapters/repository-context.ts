import { Effect, Layer, Path, ServiceMap } from "effect";

export interface RepositoryContextShape {
  readonly getRoot: () => string;
  readonly setRoot: (nextRoot: string) => void;
  readonly resolveWithinRoot: (relativePath: string) => string;
  readonly resolveGitPath: (...segments: Array<string>) => string;
}

export class RepositoryContext extends ServiceMap.Service<
  RepositoryContext,
  RepositoryContextShape
>()("app/adapters/RepositoryContext") {}

export const RepositoryContextLive = Layer.effect(
  RepositoryContext,
  Effect.gen(function*() {
    const path = yield* Path.Path;
    
    let root = path.resolve(".");

    return {
      getRoot: () => root,
      setRoot: (nextRoot: string) => {
        root = path.resolve(nextRoot);
      },
      resolveWithinRoot: (relativePath: string) => path.resolve(path.join(root, relativePath)),
      resolveGitPath: (...segments: Array<string>) => path.resolve(path.join(root, ".git", ...segments)),
    };
  }),
);
