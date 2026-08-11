# Security Policy

eli5 is an agent skill with an optional startup update checker. The checker makes a best-effort HTTPS request to this repository's raw GitHub manifest, writes a version/timestamp cache only in the host-provided plugin data directory, and prints manual update commands. It does not download releases, install updates, modify the plugin directory, or read secrets.

## Reporting a vulnerability

Report security concerns privately to **asnaripacalna@gmail.com** instead of opening a public issue. Include the impact, affected file and lines, and reproduction steps when possible. Please allow a reasonable remediation window before disclosure.

Issues in the skill instructions, update checker, cache handling, hook commands, and terminal output are in scope. Vulnerabilities in Claude, Codex, or another host should be reported to that vendor.

## Supported versions

Security fixes land on `main`. No older release branches are maintained.
