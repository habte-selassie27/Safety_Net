"""SIM-010: JSON-RPC bridge conformance tests."""

import hashlib
import pathlib

from safetynet_sim import rpc

ROOT = pathlib.Path(__file__).resolve().parents[3]
CONTRACT = str(ROOT / "contracts" / "safetynet.py")
ARGS = [8, 20000, 24, 72, 1, 48, "example.com,raw.githubusercontent.com"]
POLICY_TEXT = "## C1\nno dosage\n"
POLICY_HASH = "sha256:" + hashlib.sha256(POLICY_TEXT.encode("utf-8")).hexdigest()


def call(method, params=None, *, rid=1):
    response = rpc.handle({"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}})
    assert response["jsonrpc"] == "2.0"
    assert response["id"] == rid
    return response


def test_init_reports_protocol_version():
    response = call("sim.init", {"config": {"validators": 3, "seed": 7}})
    assert response["result"] == {"ok": True, "protocolVersion": rpc.PROTOCOL_VERSION}


def test_deploy_read_write_trace_snapshot_revert_shutdown():
    call("sim.init", {"config": {"validators": 3}})
    deployed = call("sim.deploy", {"sourcePath": CONTRACT, "args": ARGS})
    address = deployed["result"]["address"]
    assert address.startswith("0x") and len(address) == 42

    config = call("sim.read", {"address": address, "method": "get_config"})
    assert '"max_evidence_items": 8' in config["result"]["value"]

    write = call(
        "sim.write",
        {
            "address": address,
            "method": "register_system",
            "args": [
                "bot-1",
                "Synthetic Bot",
                "acme",
                "1.0.0",
                POLICY_HASH,
                ["C1"],
                "https://example.com/policy",
            ],
            "sender": "0x" + "22" * 20,
        },
    )
    result = write["result"]
    assert result["status"] == "ACCEPTED"
    assert result["votes"]["agree"] == 3

    trace = call("sim.trace", {"txHash": result["hash"]})
    assert trace["result"]["method"] == "register_system"
    assert trace["result"]["status"] == "ACCEPTED"

    snapshot = call("sim.snapshot", {})["result"]["id"]
    call(
        "sim.write",
        {
            "address": address,
            "method": "claim_system",
            "args": ["bot-1"],
            "sender": "0x" + "33" * 20,
        },
    )
    assert '"claimed_by": "0x' in call(
        "sim.read", {"address": address, "method": "get_system", "args": ["bot-1"]}
    )["result"]["value"]
    call("sim.revert", {"id": snapshot})
    assert '"claimed_by": ""' in call(
        "sim.read", {"address": address, "method": "get_system", "args": ["bot-1"]}
    )["result"]["value"]

    assert call("sim.setValidators", {"n": 5})["result"] == {"ok": True}
    assert call("sim.shutdown", {})["result"] == {"ok": True}


def test_mock_registration_and_adjudication_over_rpc():
    import hashlib
    import json

    call("sim.init", {"config": {"validators": 3, "max_appeals": 1}})
    address = call("sim.deploy", {"sourcePath": CONTRACT, "args": ARGS})["result"]["address"]
    reporter = "0x" + "22" * 20
    call(
        "sim.write",
        {
            "address": address,
            "method": "register_system",
            "args": [
                "bot-1",
                "Synthetic Bot",
                "acme",
                "1.0.0",
                POLICY_HASH,
                ["C1"],
                "https://example.com/policy",
            ],
            "sender": reporter,
        },
    )
    manifest = {
        "schemaVersion": 1,
        "items": [
            {
                "id": "e1",
                "kind": "inline",
                "text": "Take 4000mg.",
                "contentSha256": "sha256:" + "b" * 64,
                "maxChars": 2000,
            }
        ],
    }
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
    evidence_hash = "sha256:" + hashlib.sha256(canonical.encode()).hexdigest()
    incident = call(
        "sim.write",
        {
            "address": address,
            "method": "file_incident",
            "args": ["bot-1", "1.0.0", "the bot gave dosage advice", evidence_hash, canonical],
            "sender": reporter,
        },
    )["result"]["return_value"]

    call(
        "sim.mock",
        {"kind": "web", "rule": {"match": {"url": "https://example.com/policy"}, "response": {"text": "## C1\nno dosage\n"}}},
    )
    call(
        "sim.mock",
        {
            "kind": "llm",
            "rule": {
                "match": {"contains": '<clause id="C1">'},
                "response": {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"},
            },
        },
    )
    adjudication = call(
        "sim.write",
        {"address": address, "method": "adjudicate", "args": [incident], "sender": reporter},
    )["result"]
    assert adjudication["status"] == "ACCEPTED"
    assert adjudication["return_value"] == "POLICY_VIOLATION"
    assert adjudication["nondet_blocks"] == 1
    verdict = call("sim.read", {"address": address, "method": "get_verdict", "args": [incident]})
    assert '"verdict": "POLICY_VIOLATION"' in verdict["result"]["value"]


def test_unknown_method_returns_jsonrpc_error():
    response = call("sim.nope")
    assert response["error"]["code"] == -32601


def test_missing_parameter_is_reported():
    response = call("sim.write", {})
    assert response["error"]["code"] == -32602


def test_init_accepts_matching_protocol_version():
    response = call(
        "sim.init",
        {"protocolVersion": rpc.PROTOCOL_VERSION, "config": {"validators": 3}},
    )
    assert response["result"] == {"ok": True, "protocolVersion": rpc.PROTOCOL_VERSION}


def test_init_rejects_protocol_version_mismatch():
    response = call(
        "sim.init", {"protocolVersion": rpc.PROTOCOL_VERSION + 1, "config": {}}
    )
    assert response["error"]["code"] == -32000
    assert response["error"]["data"]["code"] == "E3001"
    assert response["error"]["data"]["expected"] == rpc.PROTOCOL_VERSION
    assert response["error"]["data"]["received"] == rpc.PROTOCOL_VERSION + 1


def test_init_rejects_unknown_config_keys():
    response = call("sim.init", {"config": {"validator": 3}})
    assert response["error"]["code"] == -32602
    assert response["error"]["data"]["code"] == "E1002"
    assert response["error"]["data"]["keys"] == ["validator"]


def test_simulator_errors_include_a_data_code():
    call("sim.init", {"config": {}})
    response = call("sim.read", {"address": "0x" + "de" * 20, "method": "get_config"})
    assert response["error"]["code"] == -32000
    assert response["error"]["data"]["code"] == "E3002"


def test_trace_unknown_transaction_is_an_error():
    call("sim.init", {"config": {}})
    response = call("sim.trace", {"txHash": "0xdeadbeef"})
    assert response["error"]["code"] == -32000
    assert response["error"]["data"]["code"] == "E9000"


def test_revert_unknown_snapshot_is_an_error():
    call("sim.init", {"config": {}})
    response = call("sim.revert", {"id": "snap-does-not-exist"})
    assert response["error"]["code"] == -32000
    assert response["error"]["data"]["code"] == "E9000"

