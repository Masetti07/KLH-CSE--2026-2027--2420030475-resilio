# Traditional Vastu Rule Analysis

Traditional Vastu Rule Analysis is implemented in Day 3 as an optional, transparent cultural-reference prototype. It is not presented as scientifically validated architecture, structural engineering, safety, legal, or scientific guidance.

Each future rule must contain:

- `id`
- `title`
- `room_type`
- `preferred_zones`
- `description`
- `severity`
- `source_reference`
- `enabled`

Users will define North before directional zoning is calculated. The planned interface will show rule matches, a score whose calculation is explained, and rule-by-rule reasoning. Rules must be individually identifiable and enableable so the analysis remains inspectable.

Every user-facing Vastu experience must display:

> Traditional Vastu rule analysis is provided for informational and cultural-reference purposes. It is not architectural, structural, legal, safety, engineering or scientific advice.

See [rules.md](rules.md) for the complete small rule set and sources, and [methodology.md](methodology.md) for orientation, zoning, result states, scoring, and limitations.
