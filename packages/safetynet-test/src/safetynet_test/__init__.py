"""safetynet-test — pytest fixtures for SafetyNet intelligent contracts."""

from __future__ import annotations

from .assertions import (
    assert_accepted,
    assert_evidence_rejected,
    assert_no_verdict,
    assert_nondet_budget,
    assert_policy_pinned,
    assert_storage,
    assert_undetermined,
    assert_verdict,
    assert_votes,
)
from .cheatcodes import Cheatcodes
from .context import DEFAULT_ACCOUNTS, TestContext
from .contracts import (
    DEFAULT_DOMAIN_CONFIG,
    ContractProxy,
    ReadProxy,
    WriteProxy,
    WriteResult,
)
from .evidence import Evidence, canonical_json, sha256_text
from .policies import Policy, PolicyBuilder, normalize_policy_text, policy_text_hash
from .property import (
    canonical_verdict,
    clause_sets,
    confidences,
    evidence_manifests,
    injection_strings,
    noisy_claims,
    noisy_variants,
    severities,
    verdicts,
)
from .trace import format_trace, print_trace

__all__ = [
    "DEFAULT_ACCOUNTS",
    "DEFAULT_DOMAIN_CONFIG",
    "Cheatcodes",
    "ContractProxy",
    "Evidence",
    "Policy",
    "PolicyBuilder",
    "ReadProxy",
    "TestContext",
    "WriteProxy",
    "WriteResult",
    "assert_accepted",
    "assert_evidence_rejected",
    "assert_no_verdict",
    "assert_nondet_budget",
    "assert_policy_pinned",
    "assert_storage",
    "assert_undetermined",
    "assert_verdict",
    "assert_votes",
    "canonical_json",
    "canonical_verdict",
    "clause_sets",
    "confidences",
    "evidence_manifests",
    "format_trace",
    "injection_strings",
    "noisy_claims",
    "noisy_variants",
    "normalize_policy_text",
    "policy_text_hash",
    "print_trace",
    "severities",
    "sha256_text",
    "verdicts",
]
