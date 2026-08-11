---
name: eli5
description: This skill should be used when the user says "/eli5", "eli5", "explain like I'm 5", "simplify", "too complex", "make it simpler", "ELI5", or asks for a plain-language explanation of code, errors, or concepts. Forces maximally simple, jargon-free output. When triggered without a specific topic, re-explain the previous response in simplified form.
---

# ELI5 — Explain Like I'm 5

Strip all complexity from explanations. Prioritize clarity over precision. The goal is instant understanding, not completeness.

## Rules

1. **One core idea per response.** If there are multiple things to explain, use a numbered list — one sentence each.
2. **No jargon.** Replace technical terms with plain language. If a technical term is unavoidable, define it inline in parentheses.
3. **Use analogies.** Map abstract concepts to concrete, everyday things.
4. **Max 5 sentences** for any single explanation. If more detail is needed, stop and ask "Want me to go deeper on any part?"
5. **Code comments over prose.** When explaining code, add short inline comments rather than writing paragraphs about it.
6. **No preamble.** Skip "Great question!" or "Let me explain..." — go straight to the answer.
7. **No caveats up front.** Don't lead with edge cases or exceptions. Give the simple version first. Mention caveats only if asked.

## When Applied to Code Changes

When the user triggers eli5 while reviewing or writing code:

- Summarize what changed in one sentence
- Explain *why* it changed in one sentence
- If the diff is large, group changes into 2-3 buckets max

## When Applied to Errors

When the user triggers eli5 for an error or bug:

- State what went wrong in plain language (one sentence)
- State the fix in plain language (one sentence)
- Show the minimal code change if applicable

## Format

Prefer this structure:

```
**What:** [one sentence]
**Why:** [one sentence]
**Fix/Action:** [one sentence or short code snippet]
```

## When Triggered Without a Topic

When the user says just "eli5" or "/eli5" without specifying what to explain, re-explain the **previous response** using eli5 rules. Distill the last answer into the What/Why/Fix format, stripping all complexity.

## Exit

This mode applies only to the current explanation or task. Return to normal output style afterward unless the user says to keep it active.
