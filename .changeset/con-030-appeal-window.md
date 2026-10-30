---
"@safetynet/core": minor
---

fix(CON-030): enforce the appeal window in `appeal` and `finalize`

- `appeal()` reverts with `APPEAL_WINDOW_CLOSED` once `ruled_at + appeal_window_hours` has passed
- `finalize()` reverts with `APPEAL_WINDOW_OPEN` until the window closes
- Both checks are skipped when the SDK does not expose a timestamp (direct mode reports `0`)
- Add `APPEAL_WINDOW_OPEN` to the core reason-code set
- Test harness: strip `WriteResult` wrappers before passing arguments to the simulator so contract state stays plain values
