# Implemented Traditional Vastu Rules

The Day 3 rule set is deliberately small and inspectable. These are traditional/cultural conventions used for a prototype, not scientific findings or mandatory architectural instructions. Vastu traditions and texts vary; a match does not imply safety, quality, or correctness.

Every runtime rule defines `id`, `title`, `room_type`, `preferred_zones`, `description`, `severity`, `source_reference`, and `enabled` in `app/services/vastu.py`.

| Rule | Room type | Preferred zones | Severity | Reference note |
| --- | --- | --- | --- | --- |
| `TVR-KITCHEN-01` | Kitchen | South-East | Advisory | *Shodasa-Mandira-Chakra* translation places the kitchen in the south-east. |
| `TVR-MASTER-01` | Master Bedroom | South-West | Advisory | Contemporary traditional guidance summarized by AWGP describes south/south-west for the master bedroom. |
| `TVR-LIVING-01` | Living Room | North, North-East, East | Informational | Contemporary residential Vastu convention represented in the VNSGU overview. |
| `TVR-ENTRANCE-01` | Entrance | North, North-East, East | Advisory | Contemporary residential Vastu convention represented in the VNSGU overview. |
| `TVR-POOJA-01` | Pooja / Prayer Room | North-East | Informational | *Shodasa-Mandira-Chakra* translation places the family chapel in the north-east. |
| `TVR-STUDY-01` | Study | West | Informational | *Shodasa-Mandira-Chakra* translation places study in the west. |

## References

- Archaeological Survey of India / IGNCA digitization, [*Shodasa-Mandira-Chakra*](https://ignca.gov.in/Asi_data/22951.pdf). This supplies the explicit historical room-placement statements used above.
- Akhand Jyoti / AWGP, [“Vastu guidelines on bedrooms”](https://www.awgp.org/en/literature/akhandjyoti/2004/Nov_Dec/v1.VastuShastra_VI). This records a contemporary traditional bedroom convention.
- Veer Narmad South Gujarat University-hosted overview, [“Manifestation of Indian Traditional Wisdom into Architecture”](https://vnsguj.ac.in/download/October%20to%20December%202025/Manifestation%20Of%20Indian%20Traditional%20Wisdom%20into%20Architecture.pdf). This is used only to document contemporary living/entrance conventions.
- Vibhuti Chakrabarti, [*Indian Architectural Theory and Practice: Contemporary Uses of Vastu Vidya*](https://www.routledge.com/Indian-Architectural-Theory-and-Practice-Contemporary-Uses-of-Vastu-Vi/Chakrabarti/p/book/9780700711130), for contextual treatment of textual theory and contemporary practice.

References document where conventions came from; they do not validate health, safety, engineering, or scientific claims.
