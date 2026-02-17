---
name: add-codex-skills
description: Explains how to use Codex-style skills in Cursor. Use when the user asks how to add Codex skills to Cursor, use Codex skills in Cursor, or where to put skills so Cursor can use them.
---

# Adding Codex Skills to Cursor

Codex and Cursor use the same skill format (a folder with `SKILL.md` and optional reference/scripts). They differ only by **where** each tool looks for skills.

## Where each tool looks

| Tool   | Skill directory (default)   | Scope        |
|--------|-----------------------------|--------------|
| Codex  | `$CODEX_HOME/skills`        | Usually `~/.codex/skills` |
| Cursor | `~/.cursor/skills/`        | Personal (all projects)   |
| Cursor | `.cursor/skills/`          | Project (this repo only)  |

**Do not** create skills in `~/.cursor/skills-cursor/` — that is reserved for Cursor’s built-in skills.

## How to add Codex skills to Cursor

### Option 1: Copy from an existing Codex install

If you already have skills under `~/.codex/skills/`:

1. Copy the skill folder into a Cursor skill directory:
   - **Personal (all projects):**  
     `cp -r ~/.codex/skills/<skill-name> ~/.cursor/skills/<skill-name>`
   - **This project only:**  
     `cp -r ~/.codex/skills/<skill-name> .cursor/skills/<skill-name>`
2. Restart Cursor (or reload the window) so it picks up the new skill.

### Option 2: Install from GitHub into Cursor’s path

To install from the same kind of source Codex uses (e.g. openai/skills) but into Cursor:

1. Clone or download the skill into a Cursor skill directory, e.g.  
   `~/.cursor/skills/<skill-name>` or `.cursor/skills/<skill-name>`.
2. Ensure the folder contains at least `SKILL.md` with valid frontmatter (`name`, `description`).
3. Restart or reload Cursor.

Example (manual clone into personal skills):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/openai/skills
cd skills && git sparse-checkout set skills/.curated/<skill-name>
cp -r skills/.curated/<skill-name> ~/.cursor/skills/<skill-name>
```

### Option 3: Create a new skill for Cursor

Use the **create-skill** workflow to author a new skill and place it in `~/.cursor/skills/` or `.cursor/skills/` as appropriate.

## Format compatibility

- **SKILL.md**: Same idea in both — YAML frontmatter (`name`, `description`) + markdown body. Cursor uses this.
- **Extra Codex files** (e.g. `agents/openai.yaml`): Optional in Codex for UI; Cursor ignores them. Safe to leave in the folder if you copied it.

## Summary

1. Put the skill folder in `~/.cursor/skills/<skill-name>` (personal) or `.cursor/skills/<skill-name>` (project).
2. Ensure `SKILL.md` exists with `name` and `description` in the frontmatter.
3. Restart or reload Cursor so the new skill is loaded.
