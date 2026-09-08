import { test } from "node:test";
import assert from "node:assert/strict";
import { extractYouTubeId } from "../shared/youtube";
const id = "dQw4w9WgXcQ";
test("extrai IDs de URLs padrão, curtas, Shorts e embed", () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=12`,
    `https://youtu.be/${id}?si=abc`,
    `https://youtube.com/shorts/${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/embed/${id}`,
  ])
    assert.equal(extractYouTubeId(url), id);
});
test("rejeita hosts falsos, credenciais, protocolos e IDs inválidos", () => {
  for (const url of [
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://evilyoutube.com/watch?v=${id}`,
    `https://youtube.com@evil.test/watch?v=${id}`,
    `https://user@youtube.com/watch?v=${id}`,
    `ftp://youtube.com/watch?v=${id}`,
    `javascript:alert(1)`,
    "https://youtube.com/watch?v=abc",
    `https://youtu.be/${id}/extra`,
    `https://youtube.com:8080/watch?v=${id}`,
    "não é URL",
    "",
  ])
    assert.equal(extractYouTubeId(url), null, url);
});
