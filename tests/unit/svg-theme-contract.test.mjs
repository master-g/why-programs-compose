import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	contrastRatio,
	validateSvgTheme,
} from "../../scripts/lib/svg-theme-contract.mjs";
import { checkSvgThemeTree } from "../../scripts/check-svg-theme.mjs";

const VALID_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" data-svg-theme="paper-ink-v1" viewBox="0 0 200 120">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10"><path class="svg-ink" d="M0 0L10 5L0 10Z"/></marker>
    <style>
      .svg-page { fill: #faf9f5; }
      .svg-ink { fill: #312f2f; stroke: #312f2f; }
      .svg-muted { fill: #6c6a64; }
      .svg-axis { stroke: #b8b2a8; }
      .svg-divider { stroke: #e1ddd7; }
      .svg-coral-text { fill: #a9583e; }
      .svg-coral-stroke { fill: none; stroke: #cc785c; }
      @media (prefers-color-scheme: dark) {
        .svg-page { fill: #151515; }
        .svg-ink { fill: #f0efe8; stroke: #f0efe8; }
        .svg-muted { fill: #aaa9a1; }
        .svg-axis { stroke: #8b8a83; }
        .svg-divider { stroke: #4f4f49; }
        .svg-coral-text { fill: #dc896d; }
        .svg-coral-stroke { fill: none; stroke: #e28466; }
      }
    </style>
  </defs>
  <rect class="svg-page" width="200" height="120"/>
  <path class="svg-ink" d="M10 100H180" marker-end="url(#arrow)"/>
  <path class="svg-axis" d="M20 20V100"/>
  <path class="svg-divider" d="M20 70H180"/>
  <path class="svg-coral-stroke" d="M20 90C70 30 120 80 180 20"/>
  <text class="svg-ink" x="20" y="18">主线</text>
</svg>`;

function issuesFor(source, options = {}) {
	return validateSvgTheme(source, { asset: "fixture.svg", ...options }).errors;
}

describe("SVG theme contract", () => {
	it("accepts a semantic light/dark SVG contract", () => {
		const result = validateSvgTheme(VALID_SVG, { asset: "fixture.svg" });

		assert.deepEqual(result.errors, []);
		assert.equal(result.legacy, false);
		assert.equal(result.roles.get("svg-ink").light, "#312f2f");
		assert.equal(result.roles.get("svg-ink").dark, "#f0efe8");
	});

	it("rejects an SVG without the theme marker", () => {
		const errors = issuesFor(VALID_SVG.replace(' data-svg-theme="paper-ink-v1"', ""));

		assert.ok(errors.some((issue) => issue.code === "MISSING_THEME_CONTRACT"));
	});

	it("can report legacy assets without making the migration escape implicit", () => {
		const result = validateSvgTheme(
			VALID_SVG.replace(' data-svg-theme="paper-ink-v1"', ""),
			{ asset: "fixture.svg", strict: false },
		);

		assert.deepEqual(result.errors, []);
		assert.equal(result.legacy, true);
		assert.ok(result.warnings.some((issue) => issue.code === "MISSING_THEME_CONTRACT"));
	});

	it("rejects direct color literals outside semantic role classes", () => {
		const source = VALID_SVG.replace('<path class="svg-axis" d="M20 20V100"/>', '<path fill="#b8b2a8" d="M20 20V100"/>');
		const errors = issuesFor(source);

		assert.ok(errors.some((issue) => issue.code === "DIRECT_PAINT_LITERAL"));
		assert.ok(errors.some((issue) => issue.code === "MISSING_PAINT_ROLE"));
	});

	it("rejects direct color literals inside style attributes", () => {
		const source = VALID_SVG.replace('<path class="svg-axis" d="M20 20V100"/>', '<path class="svg-axis" style="stroke: #b8b2a8" d="M20 20V100"/>');
		const errors = issuesFor(source);

		assert.ok(errors.some((issue) => issue.code === "DIRECT_PAINT_LITERAL"));
	});

	it("requires the dark media rule and a value for every used role", () => {
		const source = VALID_SVG.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n      \}/, "");
		const errors = issuesFor(source);

		assert.ok(errors.some((issue) => issue.code === "MISSING_DARK_MEDIA"));
		assert.ok(errors.some((issue) => issue.code === "MISSING_DARK_ROLE"));
	});

	it("applies the text contrast threshold to specialized roles", () => {
		const source = VALID_SVG.replace(
			".svg-coral-text { fill: #a9583e; }",
			".svg-coral-text { fill: #a9583e; }\n      .svg-special-text-warning { fill: #777777; }",
		).replace(
			".svg-coral-text { fill: #dc896d; }",
			".svg-coral-text { fill: #dc896d; }\n        .svg-special-text-warning { fill: #777777; }",
		).replace(
			'<text class="svg-ink" x="20" y="18">主线</text>',
			'<text class="svg-special-text-warning" x="20" y="18">警告</text>',
		);
		const errors = issuesFor(source);

		assert.ok(errors.some((issue) => issue.code === "CONTRAST_TOO_LOW"));
	});

	it("accepts specialized background roles without a text contrast threshold", () => {
		const source = VALID_SVG
			.replace(
				".svg-coral-text { fill: #a9583e; }",
				".svg-coral-text { fill: #a9583e; }\n      .svg-special-background-fill-panel { fill: #f3eadf; }",
			)
			.replace(
				".svg-coral-text { fill: #dc896d; }",
				".svg-coral-text { fill: #dc896d; }\n        .svg-special-background-fill-panel { fill: #403a33; }",
			)
			.replace(
				'<rect class="svg-page" width="200" height="120"/>',
				'<rect class="svg-special-background-fill-panel" width="200" height="120"/>',
			);

		assert.deepEqual(issuesFor(source), []);
	});

	it("allows safe URL paints without inventing a semantic color role", () => {
		const source = VALID_SVG.replace(
			'<rect class="svg-page" width="200" height="120"/>',
			'<rect fill="url(#arrow)" width="200" height="120"/>',
		);

		assert.deepEqual(issuesFor(source), []);
	});

	it("rejects missing internal SVG references", () => {
		const errors = issuesFor(VALID_SVG.replace("url(#arrow)", "url(#missing)"));

		assert.ok(errors.some((issue) => issue.code === "MISSING_REFERENCE"));
	});

	it("scans a published SVG tree with the same contract", () => {
		const root = mkdtempSync(join(tmpdir(), "why-models-svg-theme-"));
		try {
			writeFileSync(join(root, "fixture.svg"), VALID_SVG);
			const result = checkSvgThemeTree(root);

			assert.equal(result.checked, 1);
			assert.deepEqual(result.errors, []);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("calculates WCAG contrast ratios with normalized colors", () => {
		assert.equal(contrastRatio("#312f2f", "#faf9f5").toFixed(2), "12.63");
		assert.equal(contrastRatio("#fff", "#000").toFixed(2), "21.00");
	});
});
