import { APP_ENV, APP_STAGE, type FullEnv } from "@invoicey/env/schema";
import { env } from "@invoicey/env/server";

export { APP_ENV, APP_STAGE };
export type { FullEnv };
export { env };

export const IS_PRODUCTION_STAGE =
  env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.PRODUCTION;
export const IS_DEVELOPMENT_STAGE =
  env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.DEVELOPMENT ||
  env.NEXT_PUBLIC_APP_STAGE === undefined;
export const IS_STAGING = env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.STAGING;
export const IS_BETA = env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.BETA;
export const IS_ALPHA = env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.ALPHA;
export const IS_LOCAL = env.NODE_ENV === APP_ENV.DEVELOPMENT;
export const IS_LOCAL_DEV = env.NODE_ENV !== APP_ENV.PRODUCTION;
export const IS_DEPLOYED = env.NODE_ENV === APP_ENV.PRODUCTION;
export const IS_PROD_RELEASE =
  env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.PRODUCTION ||
  env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.BETA;
export const CURRENT_APP_STAGE = env.NEXT_PUBLIC_APP_STAGE;
