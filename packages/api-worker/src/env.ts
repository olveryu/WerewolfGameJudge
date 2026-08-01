/** Production Worker bindings generated from wrangler.toml. */
export type Env = WorkerBindings;

/** Hono app environment shared by routes and authentication middleware. */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
    isAnonymous: boolean;
  };
};
