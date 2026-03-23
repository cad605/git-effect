import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { CliInputAdapter } from "./adapters/cli-input-adapter.ts";
import { ObjectStoreOutputAdapter } from "./adapters/object-store-output-adapter.ts";
import { RepositoryContextLive } from "./adapters/repository-context.ts";
import { TransferProtocolOutputAdapter } from "./adapters/transfer-protocol-output-adapter.ts";
import { WorkingTreeOutputAdapter } from "./adapters/working-tree-output-adapter.ts";
import { GitService } from "./application/services/git.ts";

CliInputAdapter.pipe(
  Effect.provide(GitService),
  Effect.provide(ObjectStoreOutputAdapter),
  Effect.provide(WorkingTreeOutputAdapter),
  Effect.provide(RepositoryContextLive),
  Effect.provide(TransferProtocolOutputAdapter),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
