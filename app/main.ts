import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { CliInputAdapter } from "./adapters/cli-input-adapter.ts";
import { RepositoryOutputAdapter } from "./adapters/repository-output-adapter.ts";
import { TransferProtocolOutputAdapter } from "./adapters/transfer-protocol-output-adapter.ts";
import { GitService } from "./application/services/git.ts";

CliInputAdapter.pipe(
  Effect.provide(GitService),
  Effect.provide(RepositoryOutputAdapter),
  Effect.provide(TransferProtocolOutputAdapter),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
