import os
import glob
import re
import yaml
import json

workflows_dir = r"c:\github\agents-united\registry\workflows"
files = sorted(glob.glob(os.path.join(workflows_dir, "workflow-*.md")))

results = []

for filepath in files:
    filename = os.path.basename(filepath)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse YAML frontmatter
    fm_match = re.match(r"^---\r?\n(.*?)\r?\n---", content, re.DOTALL)
    fm_data = {}
    fm_raw = ""
    body = content
    if fm_match:
        fm_raw = fm_match.group(1)
        body = content[fm_match.end():]
        try:
            fm_data = yaml.safe_load(fm_raw) or {}
        except Exception as e:
            fm_data = {"parse_error": str(e)}

    # Frontmatter checks
    fm_keys = set(fm_data.keys()) if isinstance(fm_data, dict) else set()
    req_keys = {"name", "description", "bundle", "estimatedDuration"}
    missing_fm = req_keys - fm_keys
    extra_fm = fm_keys - req_keys

    # Check content sections
    has_mermaid = "```mermaid" in body or "graph " in body or "flowchart " in body
    has_phase_flowchart = bool(re.search(r"flowchart|mermaid|phase", body, re.IGNORECASE))
    has_phase_transition = bool(re.search(r"transition|phase transition", body, re.IGNORECASE))
    has_verification_gates = bool(re.search(r"verification gate|deterministic verification", body, re.IGNORECASE))
    has_tool_inputs = bool(re.search(r"tool input|required tool", body, re.IGNORECASE))
    has_validation_checkpoints = bool(re.search(r"validation checkpoint|checkpoint", body, re.IGNORECASE))
    has_rollback = bool(re.search(r"rollback|automated rollback", body, re.IGNORECASE))

    # Detailed section header search
    headers = [line.strip() for line in body.splitlines() if line.strip().startswith("#")]

    results.append({
        "filename": filename,
        "frontmatter": fm_data,
        "missing_fm_keys": list(missing_fm),
        "extra_fm_keys": list(extra_fm),
        "has_mermaid": has_mermaid,
        "has_phase_transition": has_phase_transition,
        "has_verification_gates": has_verification_gates,
        "has_tool_inputs": has_tool_inputs,
        "has_validation_checkpoints": has_validation_checkpoints,
        "has_rollback": has_rollback,
        "headers": headers,
        "line_count": len(content.splitlines()),
        "byte_count": len(content.encode("utf-8"))
    })

with open(r"c:\github\agents-united\.agents\teamwork_preview_explorer_m4_1\audit_raw.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"Audited {len(results)} files successfully.")
