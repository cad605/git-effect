import type { ObjectHash } from "../models/object.ts";

export const splitObjectLoosePath = (hash: ObjectHash) => ({
  prefix: hash.slice(0, 2),
  suffix: hash.slice(2),
});
