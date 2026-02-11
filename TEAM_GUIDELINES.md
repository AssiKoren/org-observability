Developer Tooling Guideline (from Assaf via Assi)

Principle:
- Prefer modern, stable, LTS tooling over the absolute latest releases.
- Avoid bleeding-edge versions that cause build fragility or native compatibility issues.

Rules for the team:
1. Use LTS Node (22.x or 20.x) for production and dev work unless a specific feature requires newer versions — then justify and document.
2. Prefer stable Python releases (3.10/3.11/3.12 depending on OS packaging), and use virtualenv/pipx for CLI tools.
3. Choose libraries with wide platform support and prebuilt binaries when native modules are needed (to avoid node-gyp issues).
4. Document any decision to use a non-LTS tool with a short risk assessment.
5. Keep dev environment reproducible: provide .nvmrc, python .venv instructions, and an installation README.

Implementation:
- Team Leader (Mira Cohen) to enforce these guidelines during tech choices and pull request reviews.
- DevOps (Rina) to provide stable images and a reproducible local setup.

Recorded: 2026-02-09
