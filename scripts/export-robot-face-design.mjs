import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { poseFor, parts } from "../robot-display/screen/expression.js";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false });
const builder = new XMLBuilder({ preserveOrder: true, ignoreAttributes: false, format: true });
const output = new URL("../output/robot-face-svg/", import.meta.url);
const artwork = await fs.readFile(
  new URL("../robot-display/screen/face.svg", import.meta.url),
  "utf8",
);
await fs.mkdir(output, { recursive: true });

const states = [
  ["Sleeping", "Tidur", "sleeping", "neutral", 2, 0],
  ["Waking", "Bangun", "waking", "happy", 0.6, 0],
  ["Listening", "Mendengarkan", "listening", "neutral", 2, 0],
  ["Thinking", "Memikirkan jawaban", "thinking", "neutral", 2, 0],
  ["Talking", "Berbicara", "speaking", "neutral", 2, 0.5],
  ["Happy", "Senang", "speaking", "happy", 2, 0.5],
  ["Concerned", "Khawatir", "speaking", "concerned", 2, 0.5],
  ["Warning", "Waspada", "speaking", "warning", 2, 0.5],
  ["Danger", "Bahaya", "speaking", "danger", 2, 0.5],
  ["Surprised", "Terkejut", "speaking", "surprised", 2, 0.5],
  ["Beak-Closed", "Paruh tertutup", "speaking", "neutral", 2, 0],
  ["Beak-Open", "Paruh terbuka", "speaking", "neutral", 2, 1],
];

function recolor(hex, angle) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255);
  const c = Math.cos((angle * Math.PI) / 180),
    s = Math.sin((angle * Math.PI) / 180);
  const hue = [
    [0.213 + 0.787 * c - 0.213 * s, 0.715 - 0.715 * c - 0.715 * s, 0.072 - 0.072 * c + 0.928 * s],
    [0.213 - 0.213 * c + 0.143 * s, 0.715 + 0.285 * c + 0.14 * s, 0.072 - 0.072 * c - 0.283 * s],
    [0.213 - 0.213 * c - 0.787 * s, 0.715 - 0.715 * c + 0.715 * s, 0.072 + 0.928 * c + 0.072 * s],
  ].map((row) => row.reduce((sum, weight, i) => sum + weight * rgb[i], 0));
  const luma = hue[0] * 0.213 + hue[1] * 0.715 + hue[2] * 0.072;
  return (
    "#" +
    hue
      .map((v) =>
        Math.round(Math.max(0, Math.min(1, luma + 0.98 * (v - luma))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function compile(mode, mood, time, volume, prefix = "") {
  const tree = parser.parse(artwork);
  const pose = poseFor(mode, mood, time, volume, true);
  const attributes = parts(pose);
  function visit(nodes) {
    for (const node of nodes) {
      const attrs = node[":@"];
      if (attrs) {
        const id = attrs["@_id"];
        for (const [name, value] of Object.entries(attributes[id] || {}))
          attrs["@_" + name] = value;
        for (const [name, value] of Object.entries(attrs)) {
          if (typeof value !== "string") continue;
          if (/^#[a-f0-9]{6}$/i.test(value)) attrs[name] = recolor(value, pose.hue);
          if (value.startsWith("url(#")) attrs[name] = value.replace("url(#", "url(#" + prefix);
        }
        if (id) attrs["@_id"] = prefix + id;
      }
      for (const [name, children] of Object.entries(node))
        if (name !== ":@" && Array.isArray(children)) visit(children);
    }
  }
  visit(tree);
  return builder.build(tree[0].svg);
}

function background(mode, mood) {
  return mode === "sleeping"
    ? "#e0e5f5"
    : mood === "warning"
      ? "#ffe59a"
      : mood === "danger"
        ? "#ffc8c0"
        : "#edf0ff";
}

function screen(inner, color, name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1200" viewBox="0 0 2000 1200" fill="none"><title>${name}</title><rect id="face-background" width="2000" height="1200" fill="${color}"/><g id="face-artwork" transform="translate(400 0) scale(1.8461538461538463) translate(-280 -450)">${inner}</g></svg>`;
}

const tiles = [];
for (const [index, [name, label, mode, mood, time, volume]] of states.entries()) {
  const svg = screen(
    compile(mode, mood, time, volume),
    background(mode, mood),
    `AERO-BOT — ${label}`,
  );
  if (XMLValidator.validate(svg) !== true) throw new Error(`Invalid SVG: ${name}`);
  await fs.writeFile(new URL(`${name}.svg`, output), svg);
  if (name === "Listening") await fs.writeFile(new URL("AERO-BOT-Face-Master.svg", output), svg);
  const x = 40 + (index % 3) * 540,
    y = 140 + Math.floor(index / 3) * 380;
  const tile = compile(mode, mood, time, volume, `state-${index}-`);
  tiles.push(
    `<g id="${name}" transform="translate(${x} ${y})"><rect width="500" height="312.5" rx="16" fill="${background(mode, mood)}"/><g transform="translate(93.75 0) scale(.4807692308) translate(-280 -450)">${tile}</g><text y="346" fill="#243d54" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="600">${label}</text></g>`,
  );
}
const atlas = `<svg xmlns="http://www.w3.org/2000/svg" width="1660" height="1690" viewBox="0 0 1660 1690" fill="none"><rect width="1660" height="1690" fill="#f5f7fa"/><text x="40" y="70" fill="#17344f" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="700">AERO-BOT · Desain wajah</text><text x="40" y="105" fill="#4a6176" font-family="Inter,Arial,sans-serif" font-size="20">12 pose · mata, alis, jambul dan paruh dalam layer vektor terpisah</text>${tiles.join("")}</svg>`;
if (XMLValidator.validate(atlas) !== true) throw new Error("Invalid expression atlas");
await fs.writeFile(new URL("AERO-BOT-All-Expressions.svg", output), atlas);
console.log(
  `Exported ${states.length} poses, a master face and an editable SVG atlas to ${output.pathname}`,
);
