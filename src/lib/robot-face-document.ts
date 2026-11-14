import artwork from "../../robot-display/screen/face.svg?raw";
import styles from "../../robot-display/screen/screen.css?raw";
import expression from "../../robot-display/screen/expression.js?raw";
import timeline from "../../robot-display/screen/timeline.js?raw";
import runtime from "../../robot-display/screen/screen.js?raw";
import document from "../../robot-display/screen/index.html?raw";

export function robotFaceDocument() {
  const expressions = expression.replace(/^export /gm, "");
  const screen = runtime.replace(/^import [^\n]+\r?\n/gm, "");
  const script = [
    "window.aerobotRemote = true;",
    "window.addEventListener('dblclick', () => window.parent.postMessage({type:'aerobot-settings'}, '*'));",
    `window.aerobotArtwork = ${JSON.stringify(artwork)};`,
    expressions,
    timeline.replace(/^export /gm, ""),
    screen,
  ]
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");
  return document
    .replace(/<link rel="stylesheet" href="\.\/screen\.css"\s*\/?>/, `<style>${styles}</style>`)
    .replace(
      '<script type="module" src="./screen.js"></script>',
      `<script type="module">${script}</script>`,
    );
}
