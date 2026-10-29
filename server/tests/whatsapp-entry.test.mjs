import test from "node:test";
import assert from "node:assert/strict";
import { whatsAppUrl } from "../../src/lib/whatsapp.ts";
test("WhatsApp entry pre-fills a message without sending or consenting; only phone destinations are allowed", () => {
  const start=new URL(whatsAppUrl("Mulai","628123456789"));
  assert.equal(start.origin,"https://wa.me");assert.equal(start.pathname,"/628123456789");assert.equal(start.searchParams.get("text"),"Mulai");
  const pair=new URL(whatsAppUrl("DAFTAR 1234567890abcdef","+628123456789"));
  assert.equal(pair.searchParams.get("text"),"DAFTAR 1234567890abcdef");
  for (const invalid of ["javascript:alert(1)","62812/other","62812?text=x","123",""])
    assert.equal(whatsAppUrl("Mulai",invalid),null);
  assert.equal(whatsAppUrl("","628123456789"),null);
});
