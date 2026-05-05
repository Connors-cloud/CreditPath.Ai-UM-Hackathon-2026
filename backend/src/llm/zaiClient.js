import OpenAI from 'openai';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';
import { sha256 } from '../utils/hash.js';

const MODULE = 'zaiClient';

let _client;

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.ZAI_API_KEY || 'no-key-set',
      baseURL: env.ZAI_BASE_URL
    });
  }
  return _client;
}

/**
 * Call Z.ai GLM-4.6 for a JSON-mode completion.
 * Retries once on schema validation failure.
 * @param {{ systemPrompt: string, userPrompt: string, schema: import('zod').ZodType }} opts
 * @returns {Promise<object>}
 */
export async function callLlmJson({ systemPrompt, userPrompt, schema }) {
  const fn = 'callLlmJson';
  const promptHash = sha256(systemPrompt + userPrompt).slice(0, 12);
  log.info({ module: MODULE, fn, promptHash }, 'Calling GLM-4.6 (json mode)');
  const start = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      const resp = await getClient().chat.completions.create({
        model: 'glm-4-plus',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages
      });
      const raw = resp.choices[0].message.content;
      const latency = Date.now() - start;
      const responseHash = sha256(raw).slice(0, 12);
      log.info({ module: MODULE, fn, promptHash, responseHash, latency, attempt, tokens: resp.usage }, 'GLM response received');

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`GLM returned non-JSON on attempt ${attempt}: ${raw.slice(0, 200)}`);
      }

      const validated = schema.safeParse(parsed);
      if (validated.success) return validated.data;

      if (attempt === 1) {
        log.warn({ module: MODULE, fn, errors: validated.error.flatten() }, 'LLM schema validation failed, retrying');
        // Inject schema correction message on retry
        messages.push({ role: 'assistant', content: raw });
        messages.push({ role: 'user', content: `Your previous response did not match the required JSON schema. Errors: ${JSON.stringify(validated.error.flatten())}. Please return a corrected JSON object matching exactly the schema described.` });
        continue;
      }

      log.error({ module: MODULE, fn, errors: validated.error.flatten() }, 'LLM schema validation failed after retry — falling back to null');
      return null;
    } catch (err) {
      log.error({ module: MODULE, fn, attempt, err }, 'LLM call failed');
      if (attempt === 2) throw err;
    }
  }
  return null;
}

/**
 * Call Z.ai GLM-4.6 with streaming, yielding text chunks.
 * @param {{ systemPrompt: string, userPrompt: string }} opts
 * @returns {AsyncGenerator<string>}
 */
export async function* callLlmStream({ systemPrompt, userPrompt }) {
  const fn = 'callLlmStream';
  const promptHash = sha256(systemPrompt + userPrompt).slice(0, 12);
  log.info({ module: MODULE, fn, promptHash }, 'Calling GLM-4.6 (streaming)');

  const stream = await getClient().chat.completions.create({
    model: 'glm-4-plus',
    temperature: 0,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

/**
 * Call Z.ai GLM-4.6 with a tool definition (for the strategist).
 * Returns the completed message after tool calls are resolved.
 * @param {{ systemPrompt: string, userPrompt: string, tools: object[], toolHandlers: Record<string, Function> }} opts
 * @returns {Promise<object>}
 */
export async function callLlmWithTools({ systemPrompt, userPrompt, tools, toolHandlers }) {
  const fn = 'callLlmWithTools';
  log.info({ module: MODULE, fn }, 'Calling GLM-4.6 with tools');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  for (let round = 0; round < 5; round++) {
    const resp = await getClient().chat.completions.create({
      model: 'glm-4-plus',
      temperature: 0,
      tools,
      messages
    });

    const msg = resp.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content;
    }

    for (const call of msg.tool_calls) {
      const handler = toolHandlers[call.function.name];
      if (!handler) throw new Error(`No handler for tool: ${call.function.name}`);
      const args = JSON.parse(call.function.arguments);
      log.info({ module: MODULE, fn, tool: call.function.name }, 'Executing tool call');
      const toolResult = handler(args);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
    }
  }

  throw new Error('callLlmWithTools exceeded maximum rounds');
}
