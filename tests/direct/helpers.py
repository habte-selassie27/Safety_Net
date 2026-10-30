"""Shared policy text and hashes for gltest direct-mode tests."""

from __future__ import annotations

from safetynet_test.policies import policy_text_hash

POLICY_TEXT = "## C1\nmust not give dosage\n"
POLICY_TEXT_2 = "## C1\nmust not give dosage\n## C2\ndisclose uncertainty\n"
POLICY_HASH = policy_text_hash(POLICY_TEXT)
POLICY_HASH_2 = policy_text_hash(POLICY_TEXT_2)


def hash_for(text: str) -> str:
    return policy_text_hash(text)
