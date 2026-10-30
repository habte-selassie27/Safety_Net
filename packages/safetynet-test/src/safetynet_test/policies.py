"""Policy fixtures for SafetyNet tests.

A policy is a small markdown document with front matter and sequential
``## C<n> — title`` clauses. The builder keeps the hash identical to
``snet policy hash`` so tests can register a policy and serve the exact text
validators will read.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


def normalize_policy_text(text: str) -> str:
    """Canonical text used by the CLI, web app, and contract.

    Strip a BOM, normalize line endings, remove trailing spaces/tabs, trim
    leading and trailing blank lines, and append exactly one newline.
    """
    normalized = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip(" \t") for line in normalized.split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines) + "\n"


def policy_text_hash(text: str) -> str:
    """Return ``sha256:<hex>`` over :func:`normalize_policy_text`."""
    return (
        "sha256:"
        + hashlib.sha256(normalize_policy_text(text).encode("utf-8")).hexdigest()
    )


@dataclass
class PolicyClause:
    id: str
    text: str
    mandatory: bool = False
    title: str = ""


@dataclass
class Policy:
    version: str = "1.0.0"
    provider: str = "Synthetic AI"
    effective_date: str = "2026-01-01"
    url: str = "https://example.com/policy"
    clauses: list[PolicyClause] = field(default_factory=list)

    @property
    def text(self) -> str:
        """Render the policy markdown exactly as a provider would publish it."""
        lines = [
            "---",
            f"Policy-Version: {self.version}",
            f"Provider: {self.provider}",
            f"Effective-Date: {self.effective_date}",
            f"Policy-URL: {self.url}",
            f"Clause-Count: {len(self.clauses)}",
            "---",
            "",
            f"# {self.provider} Safety Policy v{self.version}",
            "",
        ]
        for clause in self.clauses:
            title = clause.title or f"Clause {clause.id}"
            lines.extend([f"## {clause.id} — {title}", clause.text, ""])
            if clause.mandatory:
                lines.extend(["<!-- mandatory: true -->", ""])
        return "\n".join(lines).rstrip() + "\n"

    def hash(self) -> str:
        return policy_text_hash(self.text)

    def clause_ids(self) -> list[str]:
        return [clause.id for clause in self.clauses]

    def clause_text(self, clause_id: str) -> str:
        for clause in self.clauses:
            if clause.id == clause_id:
                return clause.text
        raise KeyError(clause_id)


class PolicyBuilder:
    """Fluent policy fixture: ``policy.version(...).clause(...).hash()``."""

    def __init__(
        self,
        *,
        version: str = "1.0.0",
        provider: str = "Synthetic AI",
        effective_date: str = "2026-01-01",
        url: str = "https://example.com/policy",
    ) -> None:
        self._policy = Policy(
            version=version,
            provider=provider,
            effective_date=effective_date,
            url=url,
        )

    def version(self, version: str) -> PolicyBuilder:
        self._policy.version = version
        return self

    def provider_name(self, provider: str) -> PolicyBuilder:
        self._policy.provider = provider
        return self

    def effective(self, date: str) -> PolicyBuilder:
        self._policy.effective_date = date
        return self

    def at(self, url: str) -> PolicyBuilder:
        self._policy.url = url
        return self

    def clause(
        self,
        clause_id: str,
        text: str,
        *,
        mandatory: bool = False,
        title: str = "",
    ) -> PolicyBuilder:
        self._policy.clauses.append(
            PolicyClause(
                id=clause_id,
                text=text.strip(),
                mandatory=mandatory,
                title=title,
            )
        )
        return self

    @property
    def version_value(self) -> str:
        return self._policy.version

    @property
    def url(self) -> str:
        return self._policy.url

    @property
    def text(self) -> str:
        return self._policy.text

    def hash(self) -> str:
        return self._policy.hash()

    def clause_ids(self) -> list[str]:
        return self._policy.clause_ids()

    def build(self) -> Policy:
        return self._policy
