# Traditional Vastu Rule Analysis Methodology

> Traditional Vastu rule analysis is provided for informational and cultural-reference purposes. It is not architectural, structural, legal, safety, engineering or scientific advice.

## Inputs and prerequisites

The engine consumes a saved `StructuralPlan`, design room semantics, and user-confirmed North orientation. It never reads Three.js objects. Image-top is not assumed to be North: orientation remains `null` until the user selects `0`, `90`, `180`, or `270` degrees.

The interface reports `assigned / detected` readiness, lists unassigned rooms using human labels, and explains that only rules supported by assigned semantics can be evaluated. Rules for absent semantic room types are **Not Applicable**; matching rooms without confirmed orientation are **Cannot Evaluate**. Changing any room name/type or North orientation clears the old result; the user must run analysis again.

## Directional zones

1. Calculate the structural bounding box from wall endpoints; fall back to room polygons, then the normalized unit square.
2. Normalize each room polygon centroid into that bounding box.
3. Rotate only the semantic point coordinate into a North-up frame:
   - `0°`: `(x, y)`
   - `90°`: `(y, 1-x)`
   - `180°`: `(1-x, 1-y)`
   - `270°`: `(1-y, x)`
4. Split each axis into thirds. Their Cartesian combination yields North-West, North, North-East, West, Center, East, South-West, South, or South-East.

Structural geometry is not rotated. The optional 2D overlay displays the same deterministic nine-zone calculation.

## Results and scoring

Every enabled rule yields Satisfied, Unsatisfied, Not Applicable, or Cannot Evaluate, with room, detected zone, preferred zones, severity, and explanation. Disabled rules are reported as Not Applicable and excluded.

The **Traditional Vastu Rule Match Score** is:

```text
satisfied evaluable results / (satisfied + unsatisfied evaluable results) × 100
```

Not Applicable and Cannot Evaluate are excluded. If the denominator is zero the result is **Insufficient information**, never a misleading zero.

The latest result is persisted with design ID, orientation, counts, warnings, timestamp, and analysis version. Changing design configuration clears stale persisted analysis until it is run again.

## Limitations

Centroids and a nine-zone grid are a simplified prototype methodology. The rule set does not encode plot shape, entrances on individual wall segments, furniture, elemental symbolism, regional variants, remedies, or professional interpretation. It must not be used for demolition, construction, or safety decisions.
