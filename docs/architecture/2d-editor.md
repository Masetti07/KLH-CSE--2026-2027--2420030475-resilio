# Day 2 Structural Editor

## Source of truth

The editor modifies the normalized `StructuralPlan` returned by the backend. SVG elements are projections of that model and do not hold authoritative geometry. Every edit creates a bounded in-memory structural snapshot; saving sends the complete validated model to `PUT /api/plans/{plan_id}/structure`.

## Supported corrections

- Select, add, delete, and numerically adjust walls.
- Drag selected wall endpoints while remaining within normalized bounds.
- Select rooms, rename them, and assign one of the supported room types.
- Select, add, remove, reposition, resize, re-associate, and classify openings.
- Inspect automatic confidence and wall association. Candidates below 0.6 confidence receive a faded/dashed warning treatment.
- Change the global wall height stored in the structural model.
- Undo or redo recent session edits using a bounded history of up to 30 prior snapshots.

Deleting a wall clears opening references to that wall rather than leaving corrupt identifiers. Frontend controls reject non-finite/out-of-range values and zero-length wall edits. The backend independently validates the complete document before persistence.

## Persistence and dirty state

SQLite continues to store the validated structural JSON document. A successful save increments `editing_metadata.revision`, sets `modified_by` to `manual`, and records `last_saved_at`. The workspace compares its current structural document with the last saved response to show `Unsaved changes` or `Saved`.

The browser warns before unload or plan replacement when edits are dirty. The last saved plan ID and non-sensitive display metadata are retained locally so the corrected structure can be reloaded from the backend. The original image preview is not restored after a page reload because Day 2 does not expose stored uploads as public assets.

## Validation limitations

Day 2 does not implement polygon vertex editing, wall snapping, collision detection, room-topology repair, concurrent editing, or autosave. Numeric changes are normalized rather than dimensioned architectural measurements.
