/**
 * Preload برای bun test — override ماژول server-only تا تست integration
 * بتواند ماژول‌های سرور را لود کند (مرز client/server در تست معنا ندارد).
 */

import { plugin } from "bun";

plugin({
  name: "server-only-stub",
  setup(build) {
    build.module("server-only", () => ({
      exports: {},
      loader: "object",
    }));
    build.module("server-only/empty", () => ({
      exports: {},
      loader: "object",
    }));
  },
});
