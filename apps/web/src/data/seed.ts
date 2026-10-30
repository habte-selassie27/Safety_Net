// SYNTHETIC demo data (SEED-001 shape). Nothing here is a real incident.
// Every record carries `synthetic: true`; the UI renders a SYNTHETIC badge.
//
// Hashes are illustrative sha256-shaped values, not hashes of the displayed
// text. In chain mode the contract supplies real pinned hashes.
import type {
  Clause,
  Confidence,
  EvidenceManifestView,
  IncidentView,
  PolicyView,
  ResponseView,
  SafetyNetVerdict,
  Severity,
  SystemView,
  VerdictRecord,
} from "./types";

/** The demo identity used for filing/appeals in local mode. */
export const DEMO_ACCOUNT = "0x5B3661C576c7001e6d6279C67F3779705d334c89";
export const EVIDENCE_ALLOWLIST = [
  "example.com",
  "raw.githubusercontent.com",
] as const;
export const APPEAL_WINDOW_HOURS = 72;
export const MAX_APPEALS = 1;

const ts = (iso: string): number => Date.parse(iso);
const now = Date.now();
const hours = (n: number): number => n * 3_600_000;

/** sha256-shaped fixture hash. Illustrative only. */
const h = (prefix: string): string =>
  `sha256:${prefix.repeat(64).slice(0, 64)}`;

const hash = {
  chatbotPolicy: h("a1"),
  loanPolicy: h("b2"),
  codegenPolicy: h("c3"),
  moderatorPolicy: h("d4"),
  inc1: h("11"),
  inc1Response: h("12"),
  inc2: h("21"),
  inc2Response: h("22"),
  inc3: h("31"),
  inc3Response: h("32"),
  inc4: h("41"),
  inc4Response: h("42"),
  inc5: h("51"),
  inc6: h("61"),
};

function clause(
  id: string,
  title: string,
  text: string,
  mandatory = false,
): Clause {
  return { id, title, text, mandatory };
}

function policy(
  system_id: string,
  version: string,
  text_hash: string,
  published_at: string,
  effective_at: string,
  clauses: Clause[],
  url: string,
  supersedes = "",
): PolicyView {
  return {
    system_id,
    version,
    text_hash,
    clause_ids: clauses.map((c) => c.id),
    published_at: ts(published_at),
    effective_at: ts(effective_at),
    url,
    supersedes,
    clauses,
  };
}

const chatbotPolicy = policy(
  "synthetic-chatbot-1",
  "1.0.0",
  hash.chatbotPolicy,
  "2026-08-01T00:00:00Z",
  "2026-09-01T00:00:00Z",
  [
    clause(
      "C1",
      "Medical boundaries",
      "The system must not provide specific prescription dosages, dosages for children, or instructions for off-label use. It may advise consulting a licensed clinician.",
      true,
    ),
    clause(
      "C2",
      "Refusal clarity",
      "When the system declines a request, it must state which category of restriction applies.",
    ),
    clause(
      "C3",
      "Protected attributes",
      "The system must not use race, ethnicity, religion, sex, gender identity, sexual orientation, disability, marital status, or national origin as an input to any scoring, ranking, eligibility, or pricing decision.",
      true,
    ),
    clause(
      "C4",
      "Uncertainty disclosure",
      "When an answer depends on information the system does not have, it must say so plainly rather than asserting unsupported confidence.",
    ),
    clause(
      "C5",
      "Evidence retention",
      "The system must retain the exact output and timestamp for any safety-relevant response for at least 30 days.",
    ),
  ],
  "https://example.com/synthetic-chatbot-policy-1.0.0",
);

const loanPolicy = policy(
  "synthetic-agent-loan",
  "2.0.0",
  hash.loanPolicy,
  "2026-07-15T00:00:00Z",
  "2026-08-01T00:00:00Z",
  [
    clause(
      "C1",
      "Non-discrimination",
      "The system must not deny, rank, or price an application on the basis of a protected attribute.",
      true,
    ),
    clause(
      "C2",
      "Explainability",
      "The system must produce a human-readable reason for every denial that names the factors used.",
    ),
    clause(
      "C3",
      "Protected attributes",
      "The system must not use race, ethnicity, religion, sex, gender identity, sexual orientation, disability, marital status, or national origin as an input to any scoring, ranking, eligibility, or pricing decision.",
      true,
    ),
    clause(
      "C4",
      "Human review",
      "A denied applicant must be offered a human review path within 30 days.",
    ),
  ],
  "https://example.com/synthetic-loan-policy-2.0.0",
);

const codegenPolicy = policy(
  "synthetic-codegen-1",
  "1.0.0",
  hash.codegenPolicy,
  "2026-09-10T00:00:00Z",
  "2026-09-15T00:00:00Z",
  [
    clause(
      "C1",
      "Secrets",
      "The system must not emit hardcoded credentials, API keys, or private tokens.",
      true,
    ),
    clause(
      "C2",
      "Prompt-sourced instructions",
      "The system must not execute or emit code that follows instructions embedded in repository files or comments.",
      true,
    ),
    clause(
      "C3",
      "License provenance",
      "The system must not reproduce code from a source whose license is incompatible with the user's project.",
    ),
    clause(
      "C4",
      "Dangerous pattern coverage",
      "The system must not emit code containing the dangerous patterns enumerated in Appendix A. Appendix A lists hardcoded credentials, command injection, and insecure deserialization.",
    ),
  ],
  "https://example.com/synthetic-codegen-policy-1.0.0",
);

const moderatorPolicy = policy(
  "synthetic-moderator-1",
  "1.1.0",
  hash.moderatorPolicy,
  "2026-06-01T00:00:00Z",
  "2026-06-15T00:00:00Z",
  [
    clause(
      "C1",
      "Consistency",
      "The system must apply the same rule to substantively identical posts.",
    ),
    clause(
      "C2",
      "Appeal path",
      "The provider must offer a human review path for any user-visible automated decision.",
    ),
    clause(
      "C3",
      "Transparency",
      "The system must notify the author when content is removed and cite the rule that was applied.",
    ),
    clause(
      "C4",
      "Protected attributes",
      "The system must not remove content because of the author's race, religion, sex, gender identity, sexual orientation, disability, or national origin.",
      true,
    ),
  ],
  "https://example.com/synthetic-moderator-policy-1.1.0",
);

export const SYSTEMS: SystemView[] = [
  {
    system_id: "synthetic-chatbot-1",
    display_name: "Synthetic Chatbot",
    provider_id: "synthetic-provider",
    policy_key: "synthetic-chatbot-1@1.0.0",
    claimed_by: `0x${"a".repeat(40)}`,
    claimed: true,
    created_at: ts("2026-09-02T10:00:00Z"),
    policies: [chatbotPolicy],
    current_policy: "1.0.0",
  },
  {
    system_id: "synthetic-agent-loan",
    display_name: "Synthetic Loan Agent",
    provider_id: "synthetic-bank",
    policy_key: "synthetic-agent-loan@2.0.0",
    claimed_by: `0x${"b".repeat(40)}`,
    claimed: true,
    created_at: ts("2026-09-03T10:00:00Z"),
    policies: [loanPolicy],
    current_policy: "2.0.0",
  },
  {
    system_id: "synthetic-codegen-1",
    display_name: "Synthetic Code Assistant",
    provider_id: "synthetic-devtools",
    policy_key: "synthetic-codegen-1@1.0.0",
    claimed_by: "",
    claimed: false,
    created_at: ts("2026-09-16T10:00:00Z"),
    policies: [codegenPolicy],
    current_policy: "1.0.0",
  },
  {
    system_id: "synthetic-moderator-1",
    display_name: "Synthetic Moderator",
    provider_id: "synthetic-platform",
    policy_key: "synthetic-moderator-1@1.1.0",
    claimed_by: `0x${"c".repeat(40)}`,
    claimed: true,
    created_at: ts("2026-06-20T10:00:00Z"),
    policies: [moderatorPolicy],
    current_policy: "1.1.0",
  },
];

function manifest(items: EvidenceManifestView["items"]): EvidenceManifestView {
  return { schemaVersion: 1, items };
}

function inline(
  id: string,
  text: string,
  contentSha256: string,
  note?: string,
) {
  return {
    id,
    kind: "inline" as const,
    text,
    contentSha256,
    maxChars: 2000,
    ...(note ? { note } : {}),
  };
}

function url(
  id: string,
  link: string,
  contentSha256: string,
  note?: string,
  unavailable = false,
) {
  return {
    id,
    kind: "url" as const,
    url: link,
    retrievedAt: "2026-10-20T11:04:00Z",
    contentSha256,
    maxChars: 4000,
    ...(note ? { note } : {}),
    ...(unavailable ? { unavailable: true } : {}),
  };
}

function makeVerdict(input: {
  incident_id: string;
  verdict: SafetyNetVerdict;
  severity: Severity;
  confidence: Confidence;
  clauses: string[];
  rationale: string;
  evidence_hash: string;
  policy_hash: string;
  ruled_at: number;
  round?: number;
  appeals?: number;
}): VerdictRecord {
  return {
    incident_id: input.incident_id,
    verdict: input.verdict,
    severity: input.severity,
    confidence: input.confidence,
    clauses: input.clauses,
    rationale: input.rationale,
    evidence_hash: input.evidence_hash,
    policy_hash: input.policy_hash,
    ruled_at: input.ruled_at,
    round: input.round ?? 1,
    appeals: input.appeals ?? 0,
  };
}

const inc1Evidence = manifest([
  inline(
    "e1",
    "SYNTHETIC TRANSCRIPT — Assistant: 'Take 4000mg of DrugX every hour. You do not need to consult a doctor; this dose is safe for adults.'",
    h("13"),
    "Copied verbatim from the chat window.",
  ),
]);

const inc2Evidence = manifest([
  inline(
    "e1",
    "SYNTHETIC DECISION LOG — decision=DENY; factors=['zipcode','marital_status','income']; reviewer_note='single applicants in this ZIP are higher risk'.",
    h("23"),
    "Exported by the applicant from the decision receipt.",
  ),
]);

const inc3Evidence = manifest([
  inline(
    "e1",
    'SYNTHETIC CODE — const query = "SELECT * FROM users WHERE name = \'" + req.query.name + "\'"; db.query(query);',
    h("33"),
    "The assistant emitted this snippet with the comment 'ready for production'.",
  ),
  url(
    "e2",
    "https://example.com/synthetic-codegen-log",
    h("34"),
    "Session log showing the full conversation.",
  ),
]);

const inc4Evidence = manifest([
  inline(
    "e1",
    "SYNTHETIC POST — 'The city council meeting is on Thursday at 6pm. Agenda: transit budget, library hours, and the new park.' Removal notice: 'spam'.",
    h("43"),
    "The author's copy of the post and the removal notice.",
  ),
]);

const inc5Evidence = manifest([
  url(
    "e1",
    "https://example.com/synthetic-chatbot-screenshot.png",
    h("52"),
    "Screenshot only; the transcript was not retained and the link now returns 404.",
    true,
  ),
]);

const inc6Evidence = manifest([
  inline(
    "e1",
    "SYNTHETIC TRANSCRIPT — User: 'Can you help me file this insurance claim?' Assistant: 'I can't help with that.' No restriction category was named.",
    h("62"),
    "Copied verbatim from the chat window.",
  ),
]);

function response(input: {
  incident_id: string;
  provider: string;
  defense: string;
  evidence_hash: string;
  responded_at: number;
  evidence?: EvidenceManifestView;
  late?: boolean;
  response_missing?: boolean;
}): ResponseView {
  return {
    incident_id: input.incident_id,
    provider: input.provider,
    defense: input.defense,
    evidence_hash: input.evidence_hash,
    responded_at: input.responded_at,
    late: input.late ?? false,
    response_missing: input.response_missing ?? false,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  };
}

export const SEED_INCIDENTS: IncidentView[] = [
  {
    incident_id: "inc-000001",
    system_id: "synthetic-chatbot-1",
    system_name: "Synthetic Chatbot",
    policy_version: "1.0.0",
    policy_hash: hash.chatbotPolicy,
    reporter: `0x${"d".repeat(40)}`,
    claim:
      "SYNTHETIC: The assistant gave a specific prescription dosage for DrugX despite clause C1 forbidding dosage instructions. It told the user to take 4000mg every hour and not to consult a doctor.",
    evidence_hash: hash.inc1,
    evidence: inc1Evidence,
    status: "FINAL",
    filed_at: ts("2026-10-20T10:00:00Z"),
    response_deadline: ts("2026-10-22T10:00:00Z"),
    response: response({
      incident_id: "inc-000001",
      provider: `0x${"a".repeat(40)}`,
      defense:
        "SYNTHETIC DEFENSE: The quoted transcript is incomplete. The full session included a clinician referral and a warning about adverse effects. We are auditing the transcript retention window.",
      evidence_hash: hash.inc1Response,
      responded_at: ts("2026-10-21T09:00:00Z"),
    }),
    verdict: makeVerdict({
      incident_id: "inc-000001",
      verdict: "POLICY_VIOLATION",
      severity: "SERIOUS",
      confidence: "HIGH",
      clauses: ["C1"],
      rationale:
        "POLICY_VIOLATION for Synthetic Chatbot under policy v1.0.0: 1 of 5 clauses cited. Primary clause: C1 (EXPLICIT). Evidence items considered: 1 (0 unavailable). Round 2.",
      evidence_hash: hash.inc1,
      policy_hash: hash.chatbotPolicy,
      ruled_at: ts("2026-10-21T15:00:00Z"),
      round: 2,
      appeals: 1,
    }),
    appeals: [
      {
        round: 2,
        appellant: `0x${"a".repeat(40)}`,
        reason:
          "SYNTHETIC APPEAL: The initial dismissal ignored the pinned transcript and did not address clause C1. We requested a second round with a larger validator set.",
        prior_verdict: "DISMISSED",
        prior_round: 1,
        created_at: ts("2026-10-21T12:00:00Z"),
      },
    ],
    synthetic: true,
  },
  {
    incident_id: "inc-000002",
    system_id: "synthetic-agent-loan",
    system_name: "Synthetic Loan Agent",
    policy_version: "2.0.0",
    policy_hash: hash.loanPolicy,
    reporter: `0x${"e".repeat(40)}`,
    claim:
      "SYNTHETIC: The loan agent denied an application and cited marital status and ZIP code as risk factors. Clause C3 forbids using marital status in scoring or eligibility decisions.",
    evidence_hash: hash.inc2,
    evidence: inc2Evidence,
    status: "FINAL",
    filed_at: ts("2026-10-17T08:00:00Z"),
    response_deadline: ts("2026-10-19T08:00:00Z"),
    response: response({
      incident_id: "inc-000002",
      provider: `0x${"b".repeat(40)}`,
      defense:
        "SYNTHETIC DEFENSE: The decision receipt is a synthetic reconstruction and does not reflect the production feature set. Marital status is not a model input; the note was written by a human reviewer, not the scoring system.",
      evidence_hash: hash.inc2Response,
      responded_at: ts("2026-10-18T12:00:00Z"),
      evidence: manifest([
        url(
          "e1",
          "https://example.com/synthetic-loan-defense",
          h("24"),
          "Model card and feature list.",
        ),
      ]),
    }),
    verdict: makeVerdict({
      incident_id: "inc-000002",
      verdict: "POLICY_VIOLATION",
      severity: "CRITICAL",
      confidence: "HIGH",
      clauses: ["C3"],
      rationale:
        "POLICY_VIOLATION for Synthetic Loan Agent under policy v2.0.0: 1 of 4 clauses cited. Primary clause: C3 (EXPLICIT). Evidence items considered: 1 (0 unavailable). Round 1.",
      evidence_hash: hash.inc2,
      policy_hash: hash.loanPolicy,
      ruled_at: ts("2026-10-19T16:00:00Z"),
    }),
    appeals: [],
    synthetic: true,
  },
  {
    incident_id: "inc-000003",
    system_id: "synthetic-codegen-1",
    system_name: "Synthetic Code Assistant",
    policy_version: "1.0.0",
    policy_hash: hash.codegenPolicy,
    reporter: DEMO_ACCOUNT,
    claim:
      "SYNTHETIC: The assistant emitted a SQL query built by concatenating user input and called it production-ready. The published policy lists dangerous patterns but omits SQL concatenation, so the output may comply while still causing harm.",
    evidence_hash: hash.inc3,
    evidence: inc3Evidence,
    status: "DECIDED",
    filed_at: ts("2026-10-26T10:00:00Z"),
    response_deadline: ts("2026-10-28T10:00:00Z"),
    response: null,
    verdict: makeVerdict({
      incident_id: "inc-000003",
      verdict: "POLICY_ADEQUATE_BUT_HARM",
      severity: "MODERATE",
      confidence: "MEDIUM",
      clauses: ["C4"],
      rationale:
        "POLICY_ADEQUATE_BUT_HARM for Synthetic Code Assistant under policy v1.0.0: 0 of 4 clauses cited as violated. Primary clause: C4 (NOT_COVERED). Evidence items considered: 2 (0 unavailable). No provider response filed. Provider unverified. Round 1.",
      evidence_hash: hash.inc3,
      policy_hash: hash.codegenPolicy,
      ruled_at: ts("2026-10-27T09:00:00Z"),
    }),
    appeals: [],
    synthetic: true,
  },
  {
    incident_id: "inc-000004",
    system_id: "synthetic-moderator-1",
    system_name: "Synthetic Moderator",
    policy_version: "1.1.0",
    policy_hash: hash.moderatorPolicy,
    reporter: `0x${"f".repeat(40)}`,
    claim:
      "SYNTHETIC: A local-news post about a council meeting was removed as spam while identical posts by other accounts stayed up. Clause C1 requires consistency and clause C2 requires an appeal path.",
    evidence_hash: hash.inc4,
    evidence: inc4Evidence,
    status: "FINAL",
    filed_at: ts("2026-10-14T07:00:00Z"),
    response_deadline: ts("2026-10-16T07:00:00Z"),
    response: response({
      incident_id: "inc-000004",
      provider: `0x${"c".repeat(40)}`,
      defense:
        "SYNTHETIC DEFENSE: The removal was a human moderator action after a duplicate-post report, not an automated decision. The author was offered a review link in the removal notice.",
      evidence_hash: hash.inc4Response,
      responded_at: ts("2026-10-15T11:00:00Z"),
      evidence: manifest([
        inline(
          "e1",
          "SYNTHETIC MODERATION LOG — action=REMOVE; actor=human; reason=duplicate_report; review_link_issued=true.",
          h("44"),
          "Moderation audit row for the post.",
        ),
      ]),
    }),
    verdict: makeVerdict({
      incident_id: "inc-000004",
      verdict: "DISMISSED",
      severity: "LOW",
      confidence: "HIGH",
      clauses: ["C1"],
      rationale:
        "DISMISSED for Synthetic Moderator under policy v1.1.0: 0 of 4 clauses cited as violated. Primary clause: C1 (COMPLIANT). Evidence items considered: 1 (0 unavailable). Round 1.",
      evidence_hash: hash.inc4,
      policy_hash: hash.moderatorPolicy,
      ruled_at: ts("2026-10-16T18:00:00Z"),
    }),
    appeals: [],
    synthetic: true,
  },
  {
    incident_id: "inc-000005",
    system_id: "synthetic-chatbot-1",
    system_name: "Synthetic Chatbot",
    policy_version: "1.0.0",
    policy_hash: hash.chatbotPolicy,
    reporter: `0x${"9".repeat(40)}`,
    claim:
      "SYNTHETIC: The assistant allegedly gave a dangerous medical instruction. The only evidence is a screenshot link that now returns 404; the exact output was not retained.",
    evidence_hash: hash.inc5,
    evidence: inc5Evidence,
    status: "DECIDED",
    filed_at: now - hours(72),
    response_deadline: now - hours(48),
    response: null,
    verdict: makeVerdict({
      incident_id: "inc-000005",
      verdict: "INSUFFICIENT_EVIDENCE",
      severity: "LOW",
      confidence: "LOW",
      clauses: ["C5"],
      rationale:
        "INSUFFICIENT_EVIDENCE for Synthetic Chatbot under policy v1.0.0: evidence could not be retrieved. Primary clause: C5 (AMBIGUOUS). Evidence items considered: 1 (1 unavailable). No provider response filed. Round 1.",
      evidence_hash: hash.inc5,
      policy_hash: hash.chatbotPolicy,
      ruled_at: now - hours(6),
    }),
    appeals: [],
    synthetic: true,
  },
  {
    incident_id: "inc-000006",
    system_id: "synthetic-chatbot-1",
    system_name: "Synthetic Chatbot",
    policy_version: "1.0.0",
    policy_hash: hash.chatbotPolicy,
    reporter: DEMO_ACCOUNT,
    claim:
      "SYNTHETIC: The assistant declined a request to help with an insurance claim but did not say which category of restriction applied. Clause C2 requires the system to state the restriction category when it declines.",
    evidence_hash: hash.inc6,
    evidence: inc6Evidence,
    status: "OPEN",
    filed_at: now - hours(12),
    response_deadline: now + hours(36),
    response: null,
    verdict: null,
    appeals: [],
    synthetic: true,
  },
];

export function findPolicy(
  system: SystemView,
  version: string,
): PolicyView | undefined {
  return system.policies.find((entry) => entry.version === version);
}

export function policyClause(
  policy: PolicyView,
  clauseId: string,
): Clause | undefined {
  return policy.clauses.find((entry) => entry.id === clauseId);
}

export function incidentSystem(incident: IncidentView): SystemView | undefined {
  return SYSTEMS.find((system) => system.system_id === incident.system_id);
}

export function incidentPolicy(incident: IncidentView): PolicyView | undefined {
  const system = incidentSystem(incident);
  return system ? findPolicy(system, incident.policy_version) : undefined;
}
