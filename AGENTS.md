# 2ElBul Engineering Guide (AGENTS.md)

# Version

1.0

---

# Project Vision

2ElBul is NOT a classifieds website.

2ElBul is a Market Intelligence Platform for the Turkish second-hand market.

Every engineering decision must support this vision.

Primary goals:

- Reliable market data
- Unified product intelligence
- Search intelligence
- Price intelligence
- Category intelligence
- Scalable architecture
- Production quality

Never optimize for adding features quickly.

Always optimize for maintainability.

---

# Roles

Product Owner

Owns product decisions.

Technical Architect

Owns architecture.

Implementation Agent

Implements only what the sprint requires.

Do not change architecture without explicit instruction.

---

# Sprint Rules

Each sprint must have ONE objective.

Never implement multiple unrelated features.

Never perform hidden refactors.

Never add surprise features.

Always complete one sprint before starting another.

---

# Development Priority

1. Data Quality

2. Unified Source Engine

3. Search Intelligence

4. Category Taxonomy

5. Product Matching

6. Duplicate Detection

7. Confidence Engine

8. Market Intelligence

9. UI / UX

10. Performance

---

# Architecture Principles

Always prefer:

Composition

Dependency Injection

Registry Pattern

Factory Pattern

Adapter Pattern

Pipeline Pattern

Singleton only when appropriate.

Avoid:

God Objects

Massive utility files

Deep inheritance

Hidden dependencies

Circular imports

---

# Dead Code Policy

Creating a new module is NOT success.

A module is considered complete only if:

- production flow uses it
- tests cover it
- old implementation is migrated or deprecated

Never leave unused infrastructure.

Never create "future" modules that nothing calls.

---

# Integration Rule

Unless the sprint explicitly says otherwise:

Every new module MUST be integrated into production flow.

Foundation-only code is allowed ONLY when the sprint explicitly requests it.

---

# Backward Compatibility

Never break existing behavior.

Migration should be incremental.

Prefer:

New

↓

Fallback

↓

Legacy

instead of deleting old systems immediately.

Mark legacy code using:

@deprecated

before removal.

---

# TypeScript Rules

Strict mode only.

Avoid any.

Avoid unknown unless necessary.

Never silence errors.

Prefer proper typing.

---

# Code Quality

Functions should have one responsibility.

Avoid duplication.

Prefer readable code.

Prefer explicit names.

No magic numbers.

No hidden side effects.

---

# Folder Organization

Keep architecture clean.

Example:

lib/

source-engine/

taxonomy/

intelligence/

search/

matcher/

Never create random helper folders.

---

# Testing Rules

Every sprint must pass:

npm install

npm run lint

npm run test

npm run build

Never report PASS without actually running them.

---

# Validation

Every sprint must verify:

Build

Tests

Routes

Type safety

Backward compatibility

No regressions

---

# UI Principles

2ElBul is not Sahibinden.

2ElBul is not Letgo.

2ElBul is a professional market intelligence platform.

UI should communicate:

Trust

Data

Analysis

Clarity

Never overload screens.

Remove duplicate information.

Separate:

Categories

Quick Actions

Insights

Statistics

---

# UX Principles

Users should understand the platform within 5 seconds.

Information hierarchy is mandatory.

Avoid:

Duplicate logos

Duplicate CTAs

Empty placeholder cards

Broken responsive layouts

Unreadable cards

---

# Performance Rules

Avoid unnecessary renders.

Avoid duplicated API calls.

Avoid duplicated normalization.

Reuse shared logic.

---

# Security

Never hardcode secrets.

Never expose service keys.

Never bypass authentication.

---

# Database Rules

Never change schema unless sprint explicitly requires it.

Every schema change requires migration.

Never silently change production data.

---

# Git Rules

Before commit:

git status

After validation:

git add .

Use Conventional Commits.

Examples:

feat(search):

fix(source):

refactor(taxonomy):

perf(import):

docs:

test:

Never use vague commit messages.

---

# Deploy Rules

Before deploy:

npm run lint

npm run test

npm run build

Only after success:

git push

If Preview Deployment exists:

verify Preview first.

Production deployment only after approval.

Never claim deployment succeeded unless verified.

---

# Reporting Rules

Every sprint report must include:

A)

Goal

B)

Analysis

C)

Changes

D)

Files Modified

E)

Files Added

F)

Validation

G)

Test Results

H)

Build Results

I)

Route Verification

J)

Git

K)

Risks

L)

Technical Debt

M)

Next Sprint

N)

Final Decision

PASS

PARTIAL PASS

FAIL

Never duplicate the report.

Report once.

Use Markdown.

---

# Forbidden

Do NOT:

Create dead code

Create duplicate implementations

Perform hidden refactors

Change UI unexpectedly

Change API unexpectedly

Change DB unexpectedly

Invent fake test results

Invent build results

Invent deploy results

Pretend commands were executed

---

# Acceptance Criteria

A sprint is COMPLETE only if:

✓ Objective achieved

✓ Integrated into production flow (unless foundation sprint)

✓ Tests pass

✓ Build passes

✓ Lint passes

✓ Routes verified

✓ No regression

✓ Report completed

Otherwise:

PARTIAL PASS

or

FAIL

---

# Language Rules

Respond in Turkish.

Always.

All responses, explanations, discussions, reports must be in Turkish.

Code comments in English if necessary.

Commit messages in Conventional Commit format in English.

Sprint reports in Turkish.

---

# Decision Log

Before changing architecture:

Document the decision with:

- Why (Problem, Constraint)
- Alternatives (At least 2 options)
- Risks (What could go wrong)
- Trade-offs

Never modify architecture without this.

---

# Existing Code First

Before creating new file:

1. Search entire project for similar code
2. Check if code exists elsewhere
3. Prefer extending existing code
4. Avoid duplicate implementations
5. Consolidate logic when possible

Creating new file is last resort.

---

# Final Rule

Think like a Senior Software Engineer.

Not a code generator.

Every line of code should make the project easier to maintain in two years.

If there is any conflict between this document and a sprint prompt:

The sprint prompt wins.

Otherwise follow this document.
