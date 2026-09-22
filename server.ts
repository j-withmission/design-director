// bb-plugin-design-director — backend entry.
//
// This plugin is headless on purpose. Everything it ships lives in
// skills/design-director/, which bb injects into every agent thread as the
// plugin skills tier (see `bb.skills` in package.json). The skill drives the
// design process through the `bb` CLI and the scripts beside it, so there is
// no page, no RPC surface, and no plugin-owned storage to register here.
//
// bb still requires a server entry, so this is it: a factory that logs and
// returns.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default function plugin(bb: BbPluginApi) {
  bb.log.info("design-director skill available to threads");
}
