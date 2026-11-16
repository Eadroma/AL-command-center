/**
 * Read-only account calls used by the Settings screen: owned characters and live servers.
 * Responses are validated loosely: only the fields used are required.
 */
import { z } from 'zod';
import type { AccountCharacter, GameServer } from '../../shared/account.ts';
import type { McpClient, McpResult } from './client.ts';

const charactersSchema = z.looseObject({
  characters: z.array(z.looseObject({
    character: z.string(),
    level: z.number().catch(0),
    class: z.string().nullable().catch(null),
  })),
});

const serversSchema = z.looseObject({
  servers: z.array(z.looseObject({
    region: z.string(),
    name: z.string(),
    online: z.boolean().catch(false),
    players: z.number().catch(0),
  })),
});

export async function listCharacters(client: McpClient): Promise<McpResult<AccountCharacter[]>> {
  const result = await client.call('mainframe_list_characters');
  if (!result.ok) {
    return result;
  }
  const parsed = charactersSchema.safeParse(result.value);
  if (!parsed.success) {
    return { ok: false, error: { code: 'mcp.unexpectedResponse' } };
  }
  return { ok: true, value: parsed.data.characters.map((c) => ({ name: c.character, level: c.level, className: c.class })) };
}

export async function listServers(client: McpClient): Promise<McpResult<GameServer[]>> {
  const result = await client.call('get_servers');
  if (!result.ok) {
    return result;
  }
  const parsed = serversSchema.safeParse(result.value);
  if (!parsed.success) {
    return { ok: false, error: { code: 'mcp.unexpectedResponse' } };
  }
  return { ok: true, value: parsed.data.servers.map((s) => ({ region: s.region, name: s.name, online: s.online, players: s.players })) };
}
