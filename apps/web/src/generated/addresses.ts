// AUTO-GENERATED — do not edit. Regenerate with `snet export addresses`.
// Registry: sha256:48f26cfa22278899db05dd88c77be43433cb97beb1172e75b53e3c01f9b0fdaa

export const addresses = {
  studionet: {
    SafetyNet: "0x7E2D9405CfC642F3abda3048cc2F265f7586317e",
  },
} as const;

export type NetworkName = keyof typeof addresses;

/**
 * Fail loudly when a network/contract has no recorded deployment.
 * The web app calls this at startup (§20.10).
 */
export function requireAddress(network: string, contract: string): string {
  const contracts = (addresses as Record<string, Record<string, string>>)[
    network
  ];
  const address = contracts?.[contract];
  if (!address) {
    throw new Error(
      `E7002: no ${contract} address for network "${network}". Run \`snet export addresses\` after deploying.`,
    );
  }
  return address;
}
