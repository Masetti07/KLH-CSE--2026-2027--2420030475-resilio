import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "summarize_trivy.py"
SPEC = importlib.util.spec_from_file_location("summarize_trivy", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_summary_counts_all_scanner_types_and_severities():
    report = {"Results": [{
        "Target": "example",
        "Vulnerabilities": [{"Severity": "HIGH", "VulnerabilityID": "CVE-EXAMPLE"}],
        "Secrets": [{"Severity": "CRITICAL", "RuleID": "secret-example"}],
        "Misconfigurations": [{"Severity": "LOW", "ID": "config-example"}],
    }]}
    counts, findings = MODULE.summarize(report)
    assert counts["HIGH"] == counts["CRITICAL"] == counts["LOW"] == 1
    assert counts["MEDIUM"] == counts["UNKNOWN"] == 0
    assert len(findings) == 3


def test_summary_handles_empty_report():
    counts, findings = MODULE.summarize({})
    assert sum(counts.values()) == 0
    assert findings == []
