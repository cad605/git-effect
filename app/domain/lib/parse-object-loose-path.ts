import type { ObjectHash } from "../models/object-hash.ts";

export const parseObjectLoosePath = (hash: ObjectHash) => ({
  prefix: hash.slice(0, 2),
  suffix: hash.slice(2),
});
