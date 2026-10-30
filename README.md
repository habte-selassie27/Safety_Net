# SafetyNet

> **The public, neutral, verifiable record of AI harm.**
> SafetyNet is the public record of AI harm. Anyone can report an AI safety incident with evidence. The AI provider answers. GenLayer validators decide whether the system violated its own published safety policy. Every verdict is permanent, queryable, and free to check — a neutral trust layer for the AI age.

- Owner: Joshua (GitHub: `habte-selassie27`)
- Program: GenLayer Foundation Grants — AI-Powered Applications / Exploratory Research (AI Safety)
- Primary deployment: StudioNet (gasless) → Bradbury testnet in M2
- Repo: `safetynet`

## Quickstart

```bash
snet init my-policy
cd my-policy
snet test
```

## Live deployment

- StudioNet: `0x7E2D9405CfC642F3abda3048cc2F265f7586317e` (tx `0x80e030b7a1a34607c2f20cb7aedac17c8a2fcc868fc22cb5bc8a1c903e1c10d2`)
- Verification: `deployments/studionet.verification.json` (L0–L4, source/schema/config hashes)

## Docs

See `AGENTS.md` (single source of truth) and `docs/`.

## License

MIT