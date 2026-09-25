# РИТМ 2.1.0 — Forensic persistence audit

## Confirmed root cause

The renderer and preload used two different IPC payload contracts for the same save channel:

- async `saveLocalData(payload)` wrapped the payload as `{ data: payload }` in `preload.js`;
- sync `saveLocalDataSync(payload)` sent the payload directly.

`main.js` then interpreted the outer object as the persistence payload. As a result, async saves did not expose `revision` to the main process (`revision` became 0), so stale async writes were not rejected. A final synchronous close-save did expose the revision, but older queued async writes could subsequently write a stale snapshot because the main process was no longer comparing the real revision.

A second contract mismatch was present in the file format: the async path could write the complete storage envelope, while the sync path caused `persistLocalData()` to serialize only `payload.data`, producing a bare database object on shutdown. This destroyed revision/timestamp metadata and made renderer-side recovery comparisons unreliable.

## New architecture

`storage-manager.js` is now the single persistence authority. It stores one envelope:

```text
{
  version,
  revision,
  savedAt,
  activeBranchId,
  data: { organization, branches, teachers, rooms, people, lessons }
}
```

All save IPC calls pass this same object directly. The manager:

1. loads the current revision from disk;
2. rejects any incoming revision <= current revision;
3. writes a backup of the previous primary file;
4. writes the new envelope to a unique temporary file;
5. fsyncs the temp file;
6. atomically replaces the primary file;
7. exposes diagnostics;
8. repairs a corrupt/missing primary from the best valid backup.

## Renderer lifecycle

The renderer maintains a memory state and a localStorage mirror. The persistent disk file is the primary cross-process store; localStorage is a recovery mirror only.

Load order:

```text
renderer startup
  -> read localStorage mirror
  -> load disk envelope
  -> compare revision
  -> choose newest valid state
  -> repair disk when local mirror is newer
  -> mark data ready
```

Save order:

```text
user action
  -> mutate db
  -> increment revision
  -> localStorage mirror
  -> queued async disk save
```

Close order:

```text
beforeunload/pagehide
  -> one guarded shutdown save
  -> increment revision
  -> synchronous IPC
  -> storage manager writes final envelope
```

Queued async writes that arrive after the shutdown save are rejected when their revision is older than the already-persisted revision.
