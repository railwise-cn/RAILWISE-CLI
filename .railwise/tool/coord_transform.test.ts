/// <reference path="../env.d.ts" />
import { describe, expect, test } from "bun:test"
import { gauss_forward, gauss_inverse, datum_transform } from "./coord_transform"

const ctx: any = { sessionID: "", messageID: "", agent: "", directory: "", worktree: "", abort: new AbortController().signal, metadata() {}, ask: async () => {} }

function parse(json: string) {
  return JSON.parse(json)
}

// ============================================================
// gauss_forward
// ============================================================

describe("gauss_forward", () => {
  test("known point near Hangzhou (CGCS2000, CM=120)", async () => {
    const r = parse(await gauss_forward.execute({ lat: 30.25, lon: 120.15, centralMeridian: 120, datum: "CGCS2000", addFalseEasting: true, zonePrefix: false }, ctx))
    expect(r.output.x_m).toBeCloseTo(3347836, -1)
    expect(r.output.y_m).toBeGreaterThan(500000)
    expect(r.datum).toBe("CGCS2000")
  })

  test("point on central meridian yields y ≈ 500000 with false easting", async () => {
    const r = parse(await gauss_forward.execute({ lat: 31.0, lon: 121.0, centralMeridian: 121, datum: "CGCS2000", addFalseEasting: true, zonePrefix: false }, ctx))
    expect(r.output.y_m).toBeCloseTo(500000, -2)
  })

  test("without false easting, y near 0 on central meridian", async () => {
    const r = parse(await gauss_forward.execute({ lat: 31.0, lon: 121.0, centralMeridian: 121, datum: "WGS84", addFalseEasting: false, zonePrefix: false }, ctx))
    expect(Math.abs(r.output.y_m)).toBeLessThan(1)
  })

  test("zone prefix adds band number to y", async () => {
    const r = parse(await gauss_forward.execute({ lat: 30.0, lon: 120.5, centralMeridian: 120, datum: "CGCS2000", addFalseEasting: true, zonePrefix: true }, ctx))
    expect(r.output.y_m).toBeGreaterThan(40000000)
  })

  test("Beijing54 ellipsoid produces different x than CGCS2000", async () => {
    const a = parse(await gauss_forward.execute({ lat: 30.0, lon: 114.0, centralMeridian: 114, datum: "CGCS2000", addFalseEasting: false, zonePrefix: false }, ctx))
    const b = parse(await gauss_forward.execute({ lat: 30.0, lon: 114.0, centralMeridian: 114, datum: "Beijing54", addFalseEasting: false, zonePrefix: false }, ctx))
    expect(a.output.x_m).not.toBeCloseTo(b.output.x_m, 0)
  })
})

// ============================================================
// gauss_inverse
// ============================================================

describe("gauss_inverse", () => {
  test("round-trip forward then inverse recovers original BL", async () => {
    const lat0 = 30.123456
    const lon0 = 120.654321
    const cm = 120
    const fwd = parse(await gauss_forward.execute({ lat: lat0, lon: lon0, centralMeridian: cm, datum: "CGCS2000", addFalseEasting: true, zonePrefix: false }, ctx))
    const inv = parse(await gauss_inverse.execute({ x: fwd.output.x_m, y: fwd.output.y_m, centralMeridian: cm, datum: "CGCS2000", hasFalseEasting: true, hasZonePrefix: false }, ctx))
    expect(inv.output.lat_deg).toBeCloseTo(lat0, 5)
    expect(inv.output.lon_deg).toBeCloseTo(lon0, 5)
  })

  test("round-trip with zone prefix", async () => {
    const lat0 = 31.5
    const lon0 = 121.5
    const cm = 121
    const fwd = parse(await gauss_forward.execute({ lat: lat0, lon: lon0, centralMeridian: cm, datum: "Xian80", addFalseEasting: true, zonePrefix: true }, ctx))
    const inv = parse(await gauss_inverse.execute({ x: fwd.output.x_m, y: fwd.output.y_m, centralMeridian: cm, datum: "Xian80", hasFalseEasting: true, hasZonePrefix: true }, ctx))
    expect(inv.output.lat_deg).toBeCloseTo(lat0, 5)
    expect(inv.output.lon_deg).toBeCloseTo(lon0, 5)
  })

  test("inverse on known coordinates near Beijing (Beijing54)", async () => {
    const lat0 = 39.9
    const lon0 = 116.4
    const cm = 117
    const fwd = parse(await gauss_forward.execute({ lat: lat0, lon: lon0, centralMeridian: cm, datum: "Beijing54", addFalseEasting: false, zonePrefix: false }, ctx))
    const inv = parse(await gauss_inverse.execute({ x: fwd.output.x_m, y: fwd.output.y_m, centralMeridian: cm, datum: "Beijing54", hasFalseEasting: false, hasZonePrefix: false }, ctx))
    expect(inv.output.lat_deg).toBeCloseTo(lat0, 5)
    expect(inv.output.lon_deg).toBeCloseTo(lon0, 5)
  })
})

// ============================================================
// datum_transform
// ============================================================

describe("datum_transform", () => {
  test("same datum returns identity", async () => {
    const r = parse(await datum_transform.execute({ lat: 30.0, lon: 120.0, h: 50, from: "CGCS2000", to: "CGCS2000" }, ctx))
    expect(r.output.lat).toBe(30.0)
    expect(r.output.lon).toBe(120.0)
    expect(r.output.h).toBe(50)
  })

  test("WGS84 ↔ CGCS2000 is near-identity (< 0.001° difference)", async () => {
    const r = parse(await datum_transform.execute({ lat: 31.23, lon: 121.47, h: 10, from: "WGS84", to: "CGCS2000" }, ctx))
    expect(r.output.lat_deg).toBeCloseTo(31.23, 3)
    expect(r.output.lon_deg).toBeCloseTo(121.47, 3)
  })

  test("Beijing54 → CGCS2000 produces visible shift", async () => {
    const r = parse(await datum_transform.execute({ lat: 30.0, lon: 114.0, h: 0, from: "Beijing54", to: "CGCS2000" }, ctx))
    expect(Math.abs(r.output.lat_deg - 30.0)).toBeGreaterThan(0.0001)
    expect(Math.abs(r.output.lon_deg - 114.0)).toBeGreaterThan(0.0001)
  })

  test("round-trip Beijing54 → CGCS2000 → Beijing54 recovers original", async () => {
    const lat0 = 39.9, lon0 = 116.4, h0 = 50
    const mid = parse(await datum_transform.execute({ lat: lat0, lon: lon0, h: h0, from: "Beijing54", to: "CGCS2000" }, ctx))
    const back = parse(await datum_transform.execute({ lat: mid.output.lat_deg, lon: mid.output.lon_deg, h: mid.output.h_m, from: "CGCS2000", to: "Beijing54" }, ctx))
    expect(back.output.lat_deg).toBeCloseTo(lat0, 4)
    expect(back.output.lon_deg).toBeCloseTo(lon0, 4)
    expect(back.output.h_m).toBeCloseTo(h0, 0)
  })

  test("Xian80 → WGS84 produces shift", async () => {
    const r = parse(await datum_transform.execute({ lat: 34.26, lon: 108.94, h: 400, from: "Xian80", to: "WGS84" }, ctx))
    expect(r.output.lat_deg).not.toBeCloseTo(34.26, 4)
    expect(r.from.datum).toBe("Xian80")
    expect(r.to.datum).toBe("WGS84")
  })

  test("Beijing54 → Xian80 uses direct transform", async () => {
    const r = parse(await datum_transform.execute({ lat: 30.0, lon: 114.0, h: 0, from: "Beijing54", to: "Xian80" }, ctx))
    expect(r.output.lat_deg).toBeDefined()
    expect(r.parameters_used).toBe("内置全国概略参数")
  })

  test("custom 7-parameters override built-in", async () => {
    const custom = { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, s: 0 }
    const r = parse(await datum_transform.execute({ lat: 30.0, lon: 114.0, h: 0, from: "Beijing54", to: "CGCS2000", customParams: custom }, ctx))
    expect(r.parameters_used).toBe("用户自定义七参数")
    expect(r.output.lat_deg).toBeCloseTo(30.0, 2)
  })
})
