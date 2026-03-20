import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";

import { CliInputAdapter } from "./adapters/cli-input-adapter.ts";
import { CompressionOutputAdapter } from "./adapters/compression-output-adapter.ts";
import { HashOutputAdapter } from "./adapters/crypto-output-adapter.ts";
import { RepositoryOutputAdapter } from "./adapters/repository-output-adapter.ts";
import { GitService } from "./domain/services/git.ts";

CliInputAdapter.pipe(
  Effect.provide(GitService),
  Effect.provide(RepositoryOutputAdapter),
  Effect.provide(CompressionOutputAdapter),
  Effect.provide(HashOutputAdapter),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
