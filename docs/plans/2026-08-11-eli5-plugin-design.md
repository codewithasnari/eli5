# ELI5 Plugin Design

Package the existing ELI5 skill as a public, standalone plugin at `Kyaa-A/eli5` without changing its explanation behavior.

The repository will mirror the proven `handoff` and `doesntbreak` distribution model: `skills/eli5/SKILL.md`, Claude and Codex manifests, marketplace metadata, MIT licensing, contributor/security documentation, and startup update notices. Update checks remain informational, fail open, and never install code automatically.

Version 0.1.0 will be validated with automated manifest/updater tests, Claude validation, Codex local installation, and an actual ELI5 skill invocation before the public repository is pushed and installed locally.
