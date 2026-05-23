import { describe, it, expect } from 'vitest';
import { PROVIDERS, buildRequest, parseStreamLine, deriveTitle } from '../ai.js';

describe('PROVIDERS', () => {
  it('exposes both claude and openai with required fields', () => {
    for (const k of ['claude', 'openai']) {
      const p = PROVIDERS[k];
      expect(p.label).toBeTruthy();
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.defaultModel).toBeTruthy();
      expect(Array.isArray(p.presetModels)).toBe(true);
      expect(p.presetModels.length).toBeGreaterThan(0);
    }
  });
});

describe('buildRequest (claude)', () => {
  const messages = [{ role: 'user', content: 'Hi' }];

  it('targets the Anthropic messages endpoint', () => {
    const r = buildRequest('claude', 'claude-sonnet-4-5', 'sk-ant-fake', messages);
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('sends x-api-key (not Authorization) and the anthropic-version header', () => {
    const r = buildRequest('claude', 'm', 'sk-ant-x', messages);
    expect(r.headers['x-api-key']).toBe('sk-ant-x');
    expect(r.headers['Authorization']).toBeUndefined();
    expect(r.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('sets the browser-access flag so direct fetch() works', () => {
    const r = buildRequest('claude', 'm', 'k', messages);
    expect(r.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('always includes max_tokens (required by Claude)', () => {
    const r = buildRequest('claude', 'm', 'k', messages);
    expect(r.body.max_tokens).toBeGreaterThan(0);
    const r2 = buildRequest('claude', 'm', 'k', messages, { maxTokens: 4096 });
    expect(r2.body.max_tokens).toBe(4096);
  });

  it('keeps system messages out of the `messages` array (Claude needs them as `system`)', () => {
    const r = buildRequest('claude', 'm', 'k', [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ], { system: 'You are Nova.' });
    expect(r.body.messages.every(m => m.role !== 'system')).toBe(true);
    expect(r.body.system).toBe('You are Nova.');
  });

  it('honors the stream flag', () => {
    expect(buildRequest('claude', 'm', 'k', messages).body.stream).toBe(false);
    expect(buildRequest('claude', 'm', 'k', messages, { stream: true }).body.stream).toBe(true);
  });
});

describe('buildRequest (openai)', () => {
  const messages = [{ role: 'user', content: 'Hi' }];

  it('targets the OpenAI chat-completions endpoint', () => {
    const r = buildRequest('openai', 'gpt-4o', 'sk-fake', messages);
    expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('sends a Bearer Authorization header (not x-api-key)', () => {
    const r = buildRequest('openai', 'm', 'sk-fake', messages);
    expect(r.headers['Authorization']).toBe('Bearer sk-fake');
    expect(r.headers['x-api-key']).toBeUndefined();
  });

  it('prepends a system message when opts.system is set', () => {
    const r = buildRequest('openai', 'm', 'k', messages, { system: 'Be helpful.' });
    expect(r.body.messages[0]).toEqual({ role: 'system', content: 'Be helpful.' });
    expect(r.body.messages[1].role).toBe('user');
  });

  it('does NOT include max_tokens (OpenAI defaults work)', () => {
    const r = buildRequest('openai', 'm', 'k', messages);
    expect(r.body.max_tokens).toBeUndefined();
  });
});

describe('buildRequest (errors)', () => {
  it('throws for an unknown provider', () => {
    expect(() => buildRequest('garbage', 'm', 'k', [])).toThrow(/unknown provider/);
  });
});

describe('parseStreamLine (claude)', () => {
  it('extracts text from a content_block_delta', () => {
    const line = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
    expect(parseStreamLine('claude', line)).toBe('Hello');
  });

  it('returns null for non-text events', () => {
    expect(parseStreamLine('claude', 'data: {"type":"message_start","message":{}}')).toBeNull();
    expect(parseStreamLine('claude', 'data: {"type":"message_stop"}')).toBeNull();
    expect(parseStreamLine('claude', 'data: {"type":"ping"}')).toBeNull();
  });

  it('returns null for event lines, blanks, and [DONE]', () => {
    expect(parseStreamLine('claude', 'event: message_start')).toBeNull();
    expect(parseStreamLine('claude', '')).toBeNull();
    expect(parseStreamLine('claude', 'data: [DONE]')).toBeNull();
  });

  it('returns null on malformed JSON without throwing', () => {
    expect(parseStreamLine('claude', 'data: not-json')).toBeNull();
  });
});

describe('parseStreamLine (openai)', () => {
  it('extracts content from choices[0].delta', () => {
    const line = 'data: {"id":"x","choices":[{"delta":{"content":"Hi"}}]}';
    expect(parseStreamLine('openai', line)).toBe('Hi');
  });

  it('returns null for the [DONE] terminator', () => {
    expect(parseStreamLine('openai', 'data: [DONE]')).toBeNull();
  });

  it('returns null when delta has no content (e.g. role-only chunk)', () => {
    const line = 'data: {"choices":[{"delta":{"role":"assistant"}}]}';
    expect(parseStreamLine('openai', line)).toBeNull();
  });

  it('returns null on malformed JSON without throwing', () => {
    expect(parseStreamLine('openai', 'data: {bad')).toBeNull();
  });
});

describe('parseStreamLine (general safety)', () => {
  it('handles non-string input', () => {
    expect(parseStreamLine('claude', null)).toBeNull();
    expect(parseStreamLine('claude', undefined)).toBeNull();
    expect(parseStreamLine('openai', 42)).toBeNull();
  });
});

describe('deriveTitle', () => {
  it('returns the message verbatim if short enough', () => {
    expect(deriveTitle('Hello world')).toBe('Hello world');
  });

  it('truncates long messages cleanly at a word boundary', () => {
    const long = 'This is a really long opening question that goes on and on';
    const out = deriveTitle(long, 30);
    expect(out.length).toBeLessThanOrEqual(31);  // 30 + ellipsis char
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('  ');  // no double-spaces
  });

  it('collapses whitespace', () => {
    expect(deriveTitle('hello    world')).toBe('hello world');
    expect(deriveTitle('  hello  ')).toBe('hello');
  });

  it('falls back to a default for empty input', () => {
    expect(deriveTitle('')).toBe('New chat');
    expect(deriveTitle(null)).toBe('New chat');
    expect(deriveTitle(undefined)).toBe('New chat');
  });
});
