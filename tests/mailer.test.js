const test = require("node:test");
const assert = require("node:assert/strict");
const { headerSafe } = require("../lib/mailer.js");

test("strips CRLF sequences that would split headers", () => {
  assert.equal(
    headerSafe("Jane\r\nBcc: victim@example.com"),
    "Jane Bcc: victim@example.com"
  );
});

test("strips control characters and collapses them to a space", () => {
  assert.equal(headerSafe("a\u0000b\tc\u007fd"), "a b c d");
});

test("leaves normal values untouched", () => {
  assert.equal(headerSafe("Guest Suggestion | Jane Doe"), "Guest Suggestion | Jane Doe");
});
