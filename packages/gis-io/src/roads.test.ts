import { describe, expect, it } from "vitest";
import { validateRoadCorridors, type RoadImportMeta } from "./roads.js";

const VALID_META: RoadImportMeta = {
  source: "OpenStreetMap contributors extract",
  licence: "ODbL-1.0",
  extractDate: "2026-10-15",
  bounds: [72.48, 22.98, 72.54, 23.03],
};

const fc = (features: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "FeatureCollection", features, ...extra });

const lineFeat = (coordinates: number[][], properties: Record<string, unknown> = {}) => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates },
  properties: { name: "Makarba Main Road", highway: "secondary", osm_id: "123456", ...properties },
});

const multiLineFeat = (coordinates: number[][][], properties: Record<string, unknown> = {}) => ({
  type: "Feature",
  geometry: { type: "MultiLineString", coordinates },
  properties: { name: "Sarkhej-Makarba Link", highway: "tertiary", osm_id: "789012", ...properties },
});

describe("road corridor validation (#28 positive contracts)", () => {
  it("accepts valid source-dated licensed street geometries and stages allowlisted metadata", () => {
    const geojson = fc([
      lineFeat([[72.50, 23.00], [72.51, 23.01]], { surface: "asphalt", extra_cruft: "drop_this" }),
      multiLineFeat([[[72.51, 23.01], [72.52, 23.02]], [[72.52, 23.02], [72.53, 23.03]]]),
    ]);

    const report = validateRoadCorridors(geojson, VALID_META);
    expect(report.verdict).toBe("accepted");
    expect(report.counts).toEqual({ total: 2, accepted: 2, rejected: 0, outsideBounds: 0 });
    expect(report.accepted).toHaveLength(2);

    const first = report.accepted[0]!;
    expect(first.properties).toEqual({
      name: "Makarba Main Road",
      highway: "secondary",
      osm_id: "123456",
      surface: "asphalt",
      source: "OpenStreetMap contributors extract",
      licence: "ODbL-1.0",
      extract_date: "2026-10-15",
    });
    expect(report.features[0]!.droppedProperties).toEqual(["extra_cruft"]);
  });

  it("handles features outside study bounds with a warning without moving or clipping", () => {
    const geojson = fc([
      lineFeat([[70.00, 20.00], [70.01, 20.01]], { name: "Remote Highway" }),
    ]);

    const report = validateRoadCorridors(geojson, VALID_META);
    expect(report.verdict).toBe("accepted");
    expect(report.counts.outsideBounds).toBe(1);
    expect(report.features[0]!.warnings[0]).toMatch(/outside the study bounds/);
    expect(report.accepted[0]!.geometry.coordinates).toEqual([[70.00, 20.00], [70.01, 20.01]]);
  });
});

describe("road corridor validation (#28 negative contracts)", () => {
  it("blocks restricted imagery tracing in file source", () => {
    const geojson = fc([lineFeat([[72.50, 23.00], [72.51, 23.01]])]);
    const report = validateRoadCorridors(geojson, {
      ...VALID_META,
      source: "Manual satellite_tracing from aerial imagery",
    });

    expect(report.verdict).toBe("rejected");
    expect(report.fileReasons.some((r) => r.includes("restricted imagery tracing blocked"))).toBe(true);
    expect(report.accepted).toHaveLength(0);
  });

  it("blocks restricted imagery tracing declared in feature properties", () => {
    const geojson = fc([
      lineFeat([[72.50, 23.00], [72.51, 23.01]], { method: "imagery_tracing" }),
    ]);
    const report = validateRoadCorridors(geojson, VALID_META);

    expect(report.verdict).toBe("rejected");
    expect(report.features[0]!.reasons.some((r) => r.includes("restricted imagery tracing blocked"))).toBe(true);
  });

  it("blocks unverified road names (placeholders, missing, or unverified flags)", () => {
    const unverifiedNames = [
      "unnamed road",
      "Unnamed Road",
      "unnamed",
      "unknown road",
      "street",
      "road",
      "unverified",
      "  ",
    ];

    for (const badName of unverifiedNames) {
      const geojson = fc([lineFeat([[72.50, 23.00], [72.51, 23.01]], { name: badName })]);
      const report = validateRoadCorridors(geojson, VALID_META);
      expect(report.verdict).toBe("rejected");
      expect(
        report.features[0]!.reasons.some((r) =>
          r.includes("unverified road names blocked") || r.includes("name is required")
        )
      ).toBe(true);
    }

    const unverifiedFlag = fc([
      lineFeat([[72.50, 23.00], [72.51, 23.01]], { name: "Proposed Alley", verified_name: false }),
    ]);
    const reportFlag = validateRoadCorridors(unverifiedFlag, VALID_META);
    expect(reportFlag.verdict).toBe("rejected");
    expect(reportFlag.features[0]!.reasons.some((r) => r.includes("unverified road names blocked"))).toBe(true);
  });

  it("blocks non-corridor geometries (Point, Polygon)", () => {
    const pointGeojson = fc([
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [72.50, 23.00] },
        properties: { name: "Makarba Junction" },
      },
    ]);
    const polygonGeojson = fc([
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[72.50, 23.00], [72.51, 23.00], [72.51, 23.01], [72.50, 23.01], [72.50, 23.00]]],
        },
        properties: { name: "Makarba Plaza Area" },
      },
    ]);

    const pointReport = validateRoadCorridors(pointGeojson, VALID_META);
    expect(pointReport.verdict).toBe("rejected");
    expect(pointReport.features[0]!.reasons.some((r) => r.includes("not a valid road corridor"))).toBe(true);

    const polyReport = validateRoadCorridors(polygonGeojson, VALID_META);
    expect(polyReport.verdict).toBe("rejected");
    expect(polyReport.features[0]!.reasons.some((r) => r.includes("not a valid road corridor"))).toBe(true);
  });

  it("blocks coordinates outside valid geographic range or non-finite", () => {
    const swapped = fc([lineFeat([[72.50, 123.00], [72.51, 23.01]])]);
    const reportSwapped = validateRoadCorridors(swapped, VALID_META);
    expect(reportSwapped.verdict).toBe("rejected");
    expect(reportSwapped.features[0]!.reasons.some((r) => r.includes("outside longitude"))).toBe(true);

    const singlePointLine = fc([lineFeat([[72.50, 23.00]])]);
    const reportSingle = validateRoadCorridors(singlePointLine, VALID_META);
    expect(reportSingle.verdict).toBe("rejected");
    expect(reportSingle.features[0]!.reasons.some((r) => r.includes("at least 2 positions"))).toBe(true);
  });

  it("blocks unapproved licence and invalid extract date", () => {
    const geojson = fc([lineFeat([[72.50, 23.00], [72.51, 23.01]])]);

    const badLicence = validateRoadCorridors(geojson, { ...VALID_META, licence: "proprietary-closed" });
    expect(badLicence.verdict).toBe("rejected");
    expect(badLicence.fileReasons.some((r) => r.includes("not on the approved list"))).toBe(true);

    const badDate = validateRoadCorridors(geojson, { ...VALID_META, extractDate: "not-a-date" });
    expect(badDate.verdict).toBe("rejected");
    expect(badDate.fileReasons.some((r) => r.includes("valid ISO date"))).toBe(true);
  });

  it("blocks restricted participant fields from leaking into road corridors", () => {
    const leaking = fc([
      lineFeat([[72.50, 23.00], [72.51, 23.01]], { participant_name: "Jane Doe" }),
    ]);
    const report = validateRoadCorridors(leaking, VALID_META);
    expect(report.verdict).toBe("rejected");
    expect(report.features[0]!.reasons.some((r) => r.includes("restricted field"))).toBe(true);
  });
});

