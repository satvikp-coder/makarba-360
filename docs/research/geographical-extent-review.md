# Geographical extent review (issue #5)

**Review date:** 2026-11-08  
**Status:** Desk review only; no study boundary has been selected, imported, or independently verified.  
**Decision:** Do not publish a boundary or treat “Makarba” as one administrative polygon on the evidence below.

## Purpose and terms

This review distinguishes four things that can be mistaken for one another: town-planning scheme (TP) extents, municipal wards or village limits, the locally understood Makarba neighbourhood, and the project’s researcher-defined study extent. A scheme name or a basemap label is not, by itself, a community boundary or a suitable sampling frame. The project needs a study extent selected for the approved research question and recruitment plan, then independently checked against appropriate source material and on-the-ground references.

## Desk-review evidence

| Material reviewed | What it can support | What it does not establish |
|---|---|---|
| [AMC, History of Town Planning in Gujarat (PDF)](https://ahmedabadcity.gov.in/Images/Town_Planning.pdf), accessed 2026-11-08 | AMC’s published table names multiple schemes with “Makarba” in the name: 84/A (79.76 ha, listed as preliminary submitted, dated 2014), 84/B (41.80 ha, draft sanctioned 2011), 86 (127.09 ha, draft sanctioned 2012), and 84/C (68 ha, listed as refused by Government). Other entries also combine Makarba with neighbouring place names. This is evidence that TP scheme records are scheme-specific and do not define one interchangeable Makarba extent. | The PDF’s current legal/status accuracy, a present-day consolidated boundary, the boundary of the community or a research sampling frame. The listed statuses/dates are copied as displayed, not asserted as current. No usable candidate geometry was reviewed. |
| [AMC, Zone-wise details of plots for plantation (PDF)](https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository%2C2363), accessed 2026-11-08 | The AMC table lists two individual Makarba plots under TP scheme 84/B with point coordinates. This is an example of a point-level municipal record that may help locate a named facility/plot. | A TP boundary, neighbourhood outline, suitability for sampling, or permission to reuse the coordinates as a public research layer. Individual asset points cannot be joined into a boundary. |
| [AUDA, Town Planning Scheme page](https://www.auda.org.in/TPScheme.aspx), accessed 2026-11-08 | AUDA describes TP scheme preparation, GIS-based preparation and scheme-status information. It identifies an authority/source to consult for planning records. | A Makarba study boundary. The reviewed page did not provide a Makarba polygon or resolve the project’s community/research extent. |
| [AMC GIS portal metadata](https://gis.ahmedabadcity.gov.in/portal/sharing/portals/self), accessed 2026-11-08 | The portal metadata response identifies the portal as private. It may be a route for a future authorized records request. | Public access to its layers or permission to use its data. No layer was retrieved or compared. |
| General basemap context | Basemap labels and visible roads can help orient field reviewers and identify candidate references after the study area is selected. | An authoritative or dated boundary. This review did not import, snapshot or compare an Makarba basemap extract, and no basemap label is treated as a source of boundary authority. |

The AMC planning PDF is a published record whose observed entries include dates from 2011–2014. It is a lead for obtaining scheme-specific source maps, not a current status certificate. No exact interview or participant locations are included in this review.

## Comparison and conclusion

The available municipal material is a set of scheme/status records and individual asset points. It does not provide a reviewed vector boundary for the project’s study extent. AUDA’s public planning overview describes the planning process but likewise does not supply that project boundary. The AMC GIS portal is marked private in the retrieved metadata. Basemap context cannot fill these gaps. Therefore, there is no supported geometry to compare, no authority decision on which geography defines the study, and no evidence of a completed field verification. A broad Ahmedabad extent, one TP scheme, a ward, or a hand-traced basemap outline would be an unjustified substitution.

This conclusion is intentionally limited to the materials and access observed on the review date. It does not assert that no authoritative data exists elsewhere or that these are the latest planning records.

## Review procedure before selecting or publishing an extent

1. **Confirm the research definition.** The research lead records the question, intended participants/places, inclusion and exclusion rationale, and whether the extent is a sampling frame, a display boundary, or both. Keep participant eligibility distinct from administrative boundaries.
2. **Request primary records.** Ask the relevant planning/municipal authority for the latest approved and effective map(s) for any candidate TP scheme, ward, village or other administrative unit. Request the source document, approval/status and effective date, scale, CRS, geometry format, licence/permission and provenance. Resolve which authority owns each record; do not infer authority from a place name.
3. **Review a basemap separately.** Record provider, extract/snapshot date, attribution/licence and CRS. Use it for orientation and road/context checks only. Compare candidate lines with primary records; document discrepancies rather than snapping or tracing them away.
4. **Prepare a candidate research extent.** If the question needs a community-defined rather than administrative extent, label it as a proposed research extent and record who defined it, the evidence and the decision. Do not call it an official boundary. Store candidate source files privately until rights and review are clear.
5. **Field-check safely.** Using an approved route and named non-sensitive landmarks, have two reviewers independently check whether candidate edges and included named places match the study definition. Record date, method, uncertainty and non-identifying evidence references. Do not collect interview/subject locations as boundary evidence; keep any raw GPS private under the GPS protocol.
6. **Independent decision and import.** A reviewer other than the importer checks source currency/authority, licence, geometry, CRS, topology, edge cases and the discrepancy log. Run the GIS import validator, calculate and record the file SHA-256, then record an explicit approved/rejected/pending decision in `geo-review-register.json`. A pending or rejected extent remains unavailable to public layers.
7. **Re-evaluate changes.** A new source revision or boundary version requires a new review receipt and re-evaluation of affected records against that recorded version. Never silently replace geometry or move an out-of-area record.

## Evidence required to change the status

Before marking a geometry verified, the register must identify the exact source/map and date, its authority and use permission, the imported file checksum and validator output, importer, independent reviewer and role, review method/date, and non-sensitive evidence references. `docs/research/geo-review-register.json` remains empty until that real review occurs. It is not acceptable to use an empty register, synthetic fixture, planning document, or this desk review as proof that the project boundary has been verified.

## Source and privacy limits

- No official/project boundary, coordinates, road geometry or field result is asserted here.
- Do not commit raw interview GPS, participant data, access-restricted municipal layers or approval documents with personal details.
- Keep source attribution and licence with each imported public layer. Do not trace restricted imagery.
- The current source status and access may change; re-check primary records at the time of any import or publication.
- This document records desk-review evidence only. GIS validity, field alignment and research approval remain unverified gates.
