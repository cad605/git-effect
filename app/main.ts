import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";

import { CompressionLive } from "./adapters/compression.ts";
import { CryptoLive } from "./adapters/crypto.ts";
import { GitLive } from "./adapters/git.ts";
import { root } from "./domain/commands.ts";

root.pipe(
  Effect.provide(GitLive),
  Effect.provide(CryptoLive),
  Effect.provide(CompressionLive),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
