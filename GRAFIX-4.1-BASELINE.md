# GRAFIX 4.1 BASELINE

Дата: 2026-09-23

## 4.0 artifacts

### Grafix 4.0.0 FROZEN SOURCE
SHA-256:
`02f7430ff08de6bef0f86ad9a04ddf91e4a7ef7bcdf1ec5c427eede8a855df13`

### Grafix 4.0.0 WINDOWS ACCEPTANCE CANDIDATE
SHA-256:
`74130fb7e9d1580e19b8de13c106948d23ccf127e9c39ee3f0550f9e063d2cf4`

The Windows acceptance candidate differs from the historical frozen artifact only in:
- `index.html` — minimal null guard added after a real Windows save defect;
- `grafiks_ui_static_test.js` — regression coverage for that guard;
- `SHA256SUMS.txt` — hashes updated for those two files.

The original frozen artifact remains the historical 4.0 baseline and is not rewritten.

## Git baseline

The supplied acceptance source ZIP does not contain `.git` metadata. No historical commit graph has been fabricated.

For 4.1 a new local Git repository was initialized from the Windows acceptance candidate with a single explicit import baseline commit:
`f47d6f79d8fe64f27061d086d90980edc536c854`

Branches:
- `release/4.0.0-windows-acceptance` — frozen Windows acceptance baseline;
- `develop/4.1` — 4.1 development branch.

## 4.1 development rules

Allowed now:
- solver foundation implementation;
- solver-specific tests and documentation;
- dependency metadata required by solver foundation;
- later 4.1 changes only after explicit acceptance gates.

Not allowed in this sprint:
- UI redesign;
- Constraint Studio UI;
- Schedule Advisor UI;
- mobile/web/collaboration/API work;
- unrelated bug fixes;
- changes to 4.0 acceptance branch.
