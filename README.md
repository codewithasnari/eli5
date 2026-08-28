# eli5

A plain-language explanation skill for Claude Code and Codex. It turns code, errors, and complex ideas into short explanations with everyday analogies and no unnecessary jargon.

## Install

### Claude Code plugin

Run these commands inside Claude Code:

```text
/plugin marketplace add Kyaa-A/eli5
/plugin install eli5@eli5
```

The managed plugin includes startup update notices. The notice is informational and never installs code. Claude discovers `hooks/hooks.json` automatically; the Claude plugin manifest intentionally has no `hooks` field.

### Codex plugin

```bash
codex plugin marketplace add Kyaa-A/eli5
codex plugin add eli5@eli5
```

Start a fresh Codex session, open `/hooks`, review the command, and trust it before the startup update check can run.

### Plain skill copy

```bash
git clone https://github.com/Kyaa-A/eli5.git
cp -r eli5/skills/eli5 ~/.claude/skills/eli5
# Codex:
cp -r eli5/skills/eli5 ~/.agents/skills/eli5
```

A plain copy provides the skill only. It has no managed version tracking, startup hook, or automatic update notice. Pull the repository and copy the folder again to update it.

## Usage

Ask for a simple explanation directly:

- `/eli5 why did this test fail?`
- `Explain this code like I'm 5.`
- `Make that simpler.`

If you say only `eli5` or `/eli5`, the agent simplifies its previous response. In Codex you can also invoke `$eli5` explicitly.

## Updates

Managed installs check the public GitHub manifest at most once every 24 hours after a successful check. The dependency-free checker validates the plugin name and semantic version, writes only a timestamp/version cache in the host-provided plugin data directory, and fails silently. It never downloads or runs an update.

Claude Code:

```bash
claude plugin marketplace update eli5
claude plugin update eli5@eli5
```

Restart Claude Code or run `/reload-plugins`.

Codex:

```bash
codex plugin marketplace upgrade eli5
codex plugin remove eli5@eli5
codex plugin add eli5@eli5
```

Start a new Codex session and review/trust the hook again if prompted. Set `ELI5_UPDATE_CHECK=0` to disable managed-plugin checks.

## Development

Requires Node.js 20 or newer.

The skill stays Markdown-first: `skills/eli5/SKILL.md` defines the behavior, while a small dependency-free JavaScript updater provides managed-install notices. TypeScript would add a build step without improving this narrow runtime.

```bash
npm ci
npm test
npm run validate
npm pack --dry-run
```

Behavioral evaluations in `evals/evals.json` cover concepts, errors, code, context-only invocation, and security-sensitive precision.

CI runs the same checks on pushes and pull requests. GitHub Actions are allowlisted, pinned to full commit SHAs, and kept current through weekly Dependabot updates.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

MIT. Copyright (c) 2026 Asnari Pacalna. See [LICENSE](LICENSE).
