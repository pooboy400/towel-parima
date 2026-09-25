/**
 * core/rate-limit — barrel
 */

export type { RateLimitRule, RateLimitResult, RateLimiter } from "./types";
export { InMemoryRateLimiter, rateLimiter } from "./in-memory";
export { RATE_RULES, rateKey, type RateRuleName } from "./policies";
