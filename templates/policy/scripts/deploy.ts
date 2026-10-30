import { gf } from "@safetynet/deploy";

export default async function main() {
  const sn = await gf.deployOnce("SafetyNet", { tag: "v0.1.0" });
  gf.log.info("Deployed", { address: sn.address });
}
