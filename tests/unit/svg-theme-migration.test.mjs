import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	analyzeSvgMigration,
	applySvgMigration,
	applySpecializedSvgMigration,
	structuralProjection,
} from "../../scripts/lib/svg-theme-migration.mjs";
import { contrastRatio, validateSvgTheme } from "../../scripts/lib/svg-theme-contract.mjs";

const LEGACY_STANDARD_SVG = `
<svg width="200" height="120" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10"><path d="M0 0L10 5L0 10Z" fill="#312f2f"/></marker>
  </defs>
  <rect width="200" height="120" fill="#faf9f5"/>
  <line x1="10" y1="100" x2="180" y2="100" stroke="#b8b2a8" marker-end="url(#arrow)"/>
  <path d="M10 90L100 20" fill="none" stroke="#cc785c"/>
  <circle cx="10" cy="90" r="3" fill="#312f2f"/>
  <text x="20" y="20" fill="#6c6a64">标签</text>
</svg>`;

const LEGACY_AMBIGUOUS_SVG = `
<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
  <text x="5" y="20" fill="#123456">标签</text>
  <circle cx="60" cy="40" r="12" fill="#123456"/>
</svg>`;

const LEGACY_SPECIALIZED_SVG = `
<svg width="240" height="140" viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="heat" x1="0" x2="1">
      <stop offset="0" stop-color="#315c8a"/>
      <stop offset="1" stop-color="#e89b63"/>
    </linearGradient>
  </defs>
  <style>
    .ink { fill: #29251f; }
    .axis { fill: none; stroke: #8f6840; }
    .muted { fill: #6f665b; }
  </style>
  <rect width="240" height="140" fill="#f6f0e5"/>
  <rect x="20" y="35" width="180" height="70" class="ink" fill="url(#heat)"/>
  <line x1="20" y1="115" x2="200" y2="115" class="axis"/>
  <text x="24" y="24" class="muted">专用图</text>
</svg>`;

const LEGACY_RGBA_SVG = `
<svg width="160" height="100" viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
  <style>
    .label { fill: rgba(20, 30, 40, 0.5); }
  </style>
  <text x="10" y="20" class="label">半透明标签</text>
  <circle cx="80" cy="60" r="20" style="stroke: rgba(80, 90, 100, 0.25); fill: none;"/>
</svg>`;

describe("SVG theme migration", () => {
	it("classifies a standard paper-ink SVG as safe to migrate", () => {
		const report = analyzeSvgMigration(LEGACY_STANDARD_SVG, { asset: "fixture.svg" });

		assert.equal(report.classification, "standard");
		assert.deepEqual(report.reasons, []);
		assert.equal(report.mapping["#312f2f"], "svg-ink");
		assert.equal(report.mapping["#b8b2a8"], "svg-axis");
	});

	it("routes an ambiguous color to the specialized queue", () => {
		const report = analyzeSvgMigration(LEGACY_AMBIGUOUS_SVG, { asset: "ambiguous.svg" });

		assert.equal(report.classification, "specialized");
		assert.ok(report.reasons.some((reason) => reason.code === "AMBIGUOUS_COLOR_ROLE"));
		assert.equal(report.approved, false);
	});

	it("preserves the structural projection when applying a safe mapping", () => {
		const result = applySvgMigration(LEGACY_STANDARD_SVG, { asset: "fixture.svg" });

		assert.equal(result.analysis.classification, "standard");
		assert.deepEqual(
			structuralProjection(LEGACY_STANDARD_SVG),
			structuralProjection(result.source),
		);
		assert.equal(validateSvgTheme(result.source, { asset: "fixture.svg" }).errors.length, 0);
		assert.match(result.source, /data-svg-theme="paper-ink-v1"/);
		assert.match(result.source, /\.svg-ink-fill\s*\{/);
	});

	it("refuses to apply a specialized mapping", () => {
		assert.throws(
			() => applySvgMigration(LEGACY_AMBIGUOUS_SVG, { asset: "ambiguous.svg" }),
			/不能自动迁移|specialized/,
		);
	});

	it("migrates styled and gradient assets through per-element roles", () => {
		const result = applySpecializedSvgMigration(LEGACY_SPECIALIZED_SVG, { asset: "special.svg" });

		assert.equal(result.classification, "specialized");
		assert.deepEqual(
			structuralProjection(LEGACY_SPECIALIZED_SVG),
			structuralProjection(result.source),
		);
		assert.deepEqual(validateSvgTheme(result.source, { asset: "special.svg" }).errors, []);
		assert.match(result.source, /prefers-color-scheme:\s*dark/);
		assert.match(result.source, /svg-special-(?:text|graphic|fill)-/);
		const contract = validateSvgTheme(result.source, { asset: "special.svg" });
		const textRoles = [...contract.roles.entries()]
			.filter(([role]) => role.startsWith("svg-special-text-"));
		const backgroundRoles = [...contract.roles.entries()]
			.filter(([role]) => role.startsWith("svg-special-background-"));
		assert.ok(textRoles.length > 0 && backgroundRoles.length > 0);
		for (const [, textRole] of textRoles) {
			for (const [, backgroundRole] of backgroundRoles) {
				assert.ok(contrastRatio(textRole.dark, backgroundRole.dark) >= 4.5);
			}
		}
	});

	it("preserves RGBA opacity in style blocks and inline styles", () => {
		const result = applySpecializedSvgMigration(LEGACY_RGBA_SVG, { asset: "rgba.svg" });

		assert.deepEqual(
			structuralProjection(LEGACY_RGBA_SVG),
			structuralProjection(result.source),
		);
		assert.deepEqual(validateSvgTheme(result.source, { asset: "rgba.svg" }).errors, []);
		assert.match(result.source, /svg-special-text-fill-141e28-a500/);
		assert.match(result.source, /fill-opacity: 0\.5/);
		assert.match(result.source, /svg-special-graphic-stroke-505a64-a250/);
		assert.match(result.source, /stroke-opacity: 0\.25/);
		assert.doesNotMatch(result.source, /rgba\(/);
	});

	it("refreshes already-migrated roles and rejects an invalid unchanged asset", () => {
		const migrated = applySvgMigration(LEGACY_STANDARD_SVG, { asset: "fixture.svg" }).source;
		const invalid = migrated.replace("url(#arrow)", "url(#missing)");

		assert.throws(
			() => applySpecializedSvgMigration(invalid, { asset: "invalid.svg" }),
			/MISSING_REFERENCE/,
		);
	});

	it("keeps CLI analysis read-only and requires --apply for writes", () => {
		const root = mkdtempSync(join(tmpdir(), "why-models-svg-migration-"));
		const file = join(root, "fixture.svg");
		try {
			writeFileSync(file, LEGACY_STANDARD_SVG);
			const before = readFileSync(file, "utf8");
			execFileSync(process.execPath, ["scripts/migrate-svg-theme.mjs", file], { encoding: "utf8" });
			assert.equal(readFileSync(file, "utf8"), before);
			execFileSync(process.execPath, ["scripts/migrate-svg-theme.mjs", "--apply", file], { encoding: "utf8" });
			assert.notEqual(readFileSync(file, "utf8"), before);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
