"""safetynet-sim — an in-process model of GenLayer consensus for SafetyNet.

Public API:
    Simulator, SimConfig, Vote, Outcome, Behavior, TxResult, ConsensusTrace
    canonical, simulate_tx
    storage: TreeMap, DynArray, u256, i256, Address
    mocks: MockLLM, MockWeb, MockRegistry

The simulator approximates consensus. Run `--mode network` before shipping.
"""

from __future__ import annotations

from typing import Any

from .bench import run_bench
from .engine import Deployment, Execution, Simulator, canonical
from .errors import (
    ContractRevert,
    SimError,
    SimUnsupportedFeature,
    UnmockedLLMCall,
    UnmockedWebCall,
)
from .mocks import MockCall, MockLLM, MockRegistry, MockRule, MockWeb
from .model import (
    Behavior,
    ConsensusTrace,
    Outcome,
    Round,
    SimConfig,
    TxResult,
    Validator,
    ValidatorVote,
    Vote,
    Votes,
)
from .storage import Address, DynArray, TreeMap, i256, u256

__all__ = [
    "Address",
    "Behavior",
    "ConsensusTrace",
    "ContractRevert",
    "Deployment",
    "DynArray",
    "Execution",
    "MockCall",
    "MockLLM",
    "MockRegistry",
    "MockRule",
    "MockWeb",
    "Outcome",
    "Round",
    "SimConfig",
    "SimError",
    "SimUnsupportedFeature",
    "Simulator",
    "TreeMap",
    "TxResult",
    "UnmockedLLMCall",
    "UnmockedWebCall",
    "Validator",
    "ValidatorVote",
    "Vote",
    "Votes",
    "canonical",
    "i256",
    "simulate_tx",
    "u256",
    "run_bench",
]


def simulate_tx(
    leader_output: object,
    validator_outputs: list[object],
    majority: float = 0.5,
) -> dict[str, Any]:
    """Legacy one-shot helper retained for compatibility."""
    return Simulator(
        SimConfig(validators=len(validator_outputs), majority=majority)
    ).run_tx(leader_output, validator_outputs)
