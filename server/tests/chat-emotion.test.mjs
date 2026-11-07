import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expressionFor } from "../../robot-display/screen/expression.js";

test("Gemini emotion survives Web/Robot validators and overrides keyword mood", () => {
  const payload = {
    decision: "allow",
    topic: "earthquake",
    emotion: "neutral",
    answer: "Gempa adalah getaran permukaan bumi.",
    readings: [],
    environment_refs: [],
  };
  for (const channel of ["Web", "Robot", "WhatsApp"]) {
    let source = readFileSync(
      new URL(
        channel === "Web"
          ? "../../n8n/chat-answer-validation.js"
          : "../../n8n/robot-answer-validation.js",
        import.meta.url,
      ),
      "utf8",
    );
    if (channel === "WhatsApp")
      source = readFileSync(new URL("../../n8n/chat-answer-validation.js", import.meta.url), "utf8")
        .replaceAll("hub Web", "hub WhatsApp")
        .replaceAll("input Web", "input WhatsApp");
    const lookup = (name) => ({
      first: () => ({
        json: name.startsWith("Siapkan konteks") ? { context: [], environment: [] } : {},
      }),
      item: { json: { job: { body: {} } } },
    });
    const run = (p) =>
      new Function("$json", "$", source)(
        { candidates: [{ content: { parts: [{ text: JSON.stringify(p) }] } }] },
        lookup,
      ).json;
    const result = run(payload);
    assert.equal(result.emotion, "neutral");
    assert.equal(result.decision, "allow");
    assert.equal(run({ ...payload, emotion: "untrusted" }).provider_error, true);
    assert.equal(run({ ...payload, emotion: undefined }).emotion, "neutral");
  }
  assert.equal(expressionFor("Penjelasan gempa", undefined, "happy"), "happy");
  assert.equal(expressionFor("Penjelasan gempa", "danger", "happy"), "danger");
  assert.equal(expressionFor("Ada kabar gempa"), "concerned");
});
