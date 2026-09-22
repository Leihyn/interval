/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as citation from "../citation.js";
import type * as extract from "../extract.js";
import type * as gate from "../gate.js";
import type * as guidelines from "../guidelines.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as match from "../match.js";
import type * as merge from "../merge.js";
import type * as parse from "../parse.js";
import type * as patients from "../patients.js";
import type * as replies from "../replies.js";
import type * as seed from "../seed.js";
import type * as triage from "../triage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  citation: typeof citation;
  extract: typeof extract;
  gate: typeof gate;
  guidelines: typeof guidelines;
  http: typeof http;
  items: typeof items;
  match: typeof match;
  merge: typeof merge;
  parse: typeof parse;
  patients: typeof patients;
  replies: typeof replies;
  seed: typeof seed;
  triage: typeof triage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
