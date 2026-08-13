#!/usr/bin/env node
// mock-exception: MB-4 — LLM 생성은 비결정적이고 실 호출은 크레딧을 소모한다. 치환은
// 공급자로의 HTTP 왕복 하나뿐이고, enqueue→worker→backend→SSE→앱 구간은 실제로 e2e 한다.
// Minimal OpenRouter mock for CI. Speaks just enough of the
// /v1/chat/completions contract to satisfy the openai SDK that the
// worker uses, so integration runs don't need a real OPENROUTER_API_KEY
// or network access. Plain Node http on purpose — runs as-is on a
// node:20-alpine container with no `npm install`.

'use strict';

const http = require('http');

const PORT = parseInt(process.env.PORT || '8088', 10);
const HOST = process.env.HOST || '0.0.0.0';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function previewFor(payload) {
  // The worker sends [system, user]; pick the user content if present
  // so the response loosely reflects what was asked. Fallback keeps the
  // mock useful even when the body shape changes.
  const messages = Array.isArray(payload && payload.messages) ? payload.messages : [];
  const user = messages.find((m) => m && m.role === 'user');
  const raw = (user && typeof user.content === 'string' ? user.content : '') || '';
  const trimmed = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (trimmed) {
    return `🤍 ${trimmed} — 따뜻한 순간이 떠올라요.`;
  }
  return '🤍 따뜻한 하루를 보내고 계시네요.';
}

function chatCompletion(payload) {
  const content = previewFor(payload);
  return {
    id: `chatcmpl-mock-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: (payload && payload.model) || 'openrouter-mock',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '';
  const method = req.method || 'GET';

  if (method === 'GET' && (url === '/health' || url === '/healthz')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Accept both /chat/completions and /v1/chat/completions so the mock
  // works whether callers include /v1 in their baseURL or not.
  if (method === 'POST' && /\/chat\/completions\/?$/.test(url)) {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const body = chatCompletion(payload);
      const json = JSON.stringify(body);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
      });
      res.end(json);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          msg: 'mock chat.completion',
          model: body.model,
          preview: body.choices[0].message.content,
        }),
      );
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: String(err && err.message) || 'bad request' } }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'not found' } }));
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`openrouter-mock listening on http://${HOST}:${PORT}`);
});
