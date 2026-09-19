#!/usr/bin/env python3
"""Create a compact, reproducible Markdown summary from a Trivy JSON report."""

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def summarize(report: dict) -> tuple[Counter, list[dict]]:
    counts: Counter = Counter({severity: 0 for severity in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN")})
    findings = []
    for result in report.get("Results") or []:
        target = result.get("Target", "unknown")
        labels = {"Vulnerabilities": "Vulnerability", "Misconfigurations": "Misconfiguration", "Secrets": "Secret"}
        for finding_type, label in labels.items():
            for item in result.get(finding_type) or []:
                severity = item.get("Severity", "UNKNOWN").upper()
                counts[severity] += 1
                findings.append({
                    "severity": severity, "type": label, "target": target,
                    "id": item.get("VulnerabilityID") or item.get("ID") or item.get("RuleID") or "unidentified",
                    "title": item.get("Title") or item.get("PkgName") or item.get("Category") or "",
                    "fixed_version": item.get("FixedVersion") or "",
                })
    return counts, findings


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--trivy-version", default="not recorded")
    parser.add_argument("--scanners", default="vuln,secret,misconfig")
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    counts, findings = summarize(report)
    schema_version = report.get("SchemaVersion", "unknown")
    lines = [
        "# Trivy security summary", "", f"- Generated: {datetime.now(timezone.utc).isoformat()}",
        f"- Trivy version: {args.trivy_version}", f"- Trivy report schema: {schema_version}", f"- Scan target: repository filesystem",
        f"- Scanners: {args.scanners}", "",
        "## Counts", "", "| Severity | Count |", "| --- | ---: |",
    ]
    lines.extend(f"| {severity} | {counts[severity]} |" for severity in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"))
    lines.extend(["", "## HIGH and CRITICAL findings", ""])
    serious = [item for item in findings if item["severity"] in {"HIGH", "CRITICAL"}]
    if serious:
        lines.extend(["| Severity | Type | ID | Target | Fixed version |", "| --- | --- | --- | --- | --- |"])
        lines.extend(f"| {item['severity']} | {item['type']} | {item['id']} | {item['target']} | {item['fixed_version'] or 'Not reported'} |" for item in serious)
    else:
        lines.append("No HIGH or CRITICAL findings were reported.")
    lines.extend(["", "## Interpretation", "", "Counts are generated directly from the accompanying Trivy JSON report. A zero count applies only to the listed scanners and is not a guarantee of security; coverage depends on Trivy's databases, supported manifests, and scanner capabilities.", ""])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
