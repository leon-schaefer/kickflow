import { afterEach, expect, it, vi } from 'vitest';
import { askTransferAssistant } from './openRouter';

afterEach(() => vi.unstubAllGlobals());

function completion(message: object) {
  return Response.json({ choices: [{ message }] });
}

it('loads a requested player and sends the tool result back to GPT-6 Luna', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(completion({
      content: null,
      tool_calls: [{
        id: 'player-1',
        type: 'function',
        function: { name: 'get_kickflow_player', arguments: '{"query":"Joshua Kimmich"}' },
      }],
    }))
    .mockResolvedValueOnce(completion({ content: 'Kimmich passt zu deiner Elf.' }));
  vi.stubGlobal('fetch', fetchMock);
  const lookupPlayer = vi.fn().mockResolvedValue({ name: 'Joshua Kimmich', goals: 2 });
  const signal = new AbortController().signal;

  await expect(askTransferAssistant({
    apiKey: 'test-key',
    question: 'Soll ich Kimmich kaufen?',
    context: { balance: 10_000_000 },
    history: [],
    lookupPlayer,
    signal,
  })).resolves.toBe('Kimmich passt zu deiner Elf.');

  expect(lookupPlayer).toHaveBeenCalledExactlyOnceWith('Joshua Kimmich', signal);
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  expect(options.headers.Authorization).toBe('Bearer test-key');
  expect(options.body).not.toContain('test-key');
  const payload = JSON.parse(options.body);
  expect(payload.model).toBe('openai/gpt-6-luna');
  expect(payload.messages.at(-1)).toEqual({
    role: 'tool',
    tool_call_id: 'player-1',
    content: '{"name":"Joshua Kimmich","goals":2}',
  });
});

it('does not execute unrecognized tools or invalid arguments', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(completion({
      tool_calls: [
        { id: '1', type: 'function', function: { name: 'place_offer', arguments: '{"query":"Kimmich"}' } },
        { id: '2', type: 'function', function: { name: 'get_kickflow_player', arguments: '{}' } },
      ],
    }))
    .mockResolvedValueOnce(completion({ content: 'Dazu fehlen Daten.' }));
  vi.stubGlobal('fetch', fetchMock);
  const lookupPlayer = vi.fn();

  await expect(askTransferAssistant({
    apiKey: 'test-key', question: 'Kaufen?', context: {}, history: [], lookupPlayer,
    signal: new AbortController().signal,
  })).resolves.toBe('Dazu fehlen Daten.');
  expect(lookupPlayer).not.toHaveBeenCalled();
});
