# Data

This directory contains three original deterministic synthetic floor plans generated specifically for ResilioSpace by `generators/generate_sample_plans.py`. They exercise clean walls, rooms, simple door symbols, and windows without relying on downloaded datasets.

- `sample_simple_1bed.png`
- `sample_compact_2bed.png`
- `sample_family_house.png`

Sample filenames describe bedrooms, not total detected rooms. Room counts are always derived from valid enclosed image geometry. In `sample_simple_1bed.png`, the generator draws three functional regions (Living, Bedroom, and Kitchen); a whole-interior contour is an enclosing duplicate and is not a fourth room.

The samples are testing fixtures, not architectural designs or evidence of general reconstruction accuracy. Future data must contain no sensitive information and must document format, origin, intended test use, and limitations.
