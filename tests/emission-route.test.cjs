const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readEmissionChunks = () =>
    fs.readdirSync(path.join(root, "emission", "_next", "static", "chunks"))
        .filter((name) => name.endsWith(".js"))
        .map((name) => read(path.join("emission", "_next", "static", "chunks", name)))
        .join("\n");

test("exposes Emission as a dedicated same-origin explorer tab", function () {
    const index = read("index.html");
    const app = read("js/app.js");

    assert.match(index, /v-if="item\.href"[\s\S]*?:href="item\.href"/);
    assert.match(app, /name: "emission", label: "Emission", icon: "fa-coins", href: "\/emission\/"/);
    assert.doesNotMatch(index + app, /matthewfreeman\.github\.io/i);
});

test("ships a self-contained official-domain emission export", function () {
    const html = read("emission/index.html");
    const assetPaths = Array.from(
        html.matchAll(/(?:src|href)="(\/emission\/[^"#?]+)"/g),
        (match) => match[1],
    );

    assert.match(html, /<link rel="canonical" href="https:\/\/explorer\.discrete\.cash\/emission\/"/);
    assert.match(html, /href="https:\/\/explorer\.discrete\.cash\/" aria-label="Back to Discrete Explorer"/);
    assert.doesNotMatch(html, /matthewfreeman\.github\.io/i);
    assert.ok(assetPaths.length > 10, "expected the static export to reference its bundled assets");

    for (const assetPath of new Set(assetPaths)) {
        const relativePath = assetPath.slice("/emission/".length);
        assert.equal(fs.existsSync(path.join(root, "emission", relativePath)), true, `missing ${assetPath}`);
    }

    assert.equal(fs.existsSync(path.join(root, ".nojekyll")), true);
});

test("anchors Today to the live Discrete chain tip", function () {
    const html = read("emission/index.html");
    const chunks = readEmissionChunks();

    assert.match(html, /Actual chain tip/);
    assert.match(html, />Today</);
    assert.match(chunks, /https:\/\/seed1\.discrete\.cash:9332/);
    assert.match(chunks, /https:\/\/seed2\.discrete\.cash:9332/);
    assert.match(chunks, /getblockheaderbyheight/);
    assert.match(chunks, /already_generated_coins/);
    assert.match(chunks, /next_reward/);
    assert.match(chunks, /let \w+=\w+-1,\w+=await [\s\S]{0,300}?getblockheaderbyheight/);
});

test("preserves the reviewed 120-month CSV artifact", function () {
    const csv = fs.readFileSync(path.join(root, "emission", "data", "emission-decade.csv"));
    const digest = crypto.createHash("sha256").update(csv).digest("hex").toUpperCase();
    const rows = csv.toString("utf8").trimEnd().split(/\r?\n/);

    assert.equal(rows.length, 121);
    assert.equal(digest, "F9EF57271022D67C65F2224F2173EF9C8F3DF34B9D8B5D3375C3238729EB8A85");
});
