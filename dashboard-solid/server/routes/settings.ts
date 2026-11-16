/**
 * Settings routes: read (never the token), test a token, save.
 * Bodies are validated here, at the trust boundary; errors are codes the UI translates.
 */
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { SettingsResponse, SettingsState } from '../../shared/settings.ts';
import { settingsUpdateSchema, toPublicSettings } from '../../shared/settings.ts';
import type { SettingsHolder } from '../settings/holder.ts';

export function toSettingsResponse(state: SettingsState): SettingsResponse {
  return state.status === 'ready' ? { status: 'ready', file: state.file, settings: toPublicSettings(state.settings) } : state;
}

const testSchema = z.object({ mcpToken: z.string().trim().default('') });

async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return null;
  }
}

export function settingsRoutes(app: Hono, holder: SettingsHolder): void {
  app.get('/api/settings', (context) => context.json(toSettingsResponse(holder.state())));

  app.post('/api/settings/test', async (context) => {
    const input = testSchema.safeParse(await readJson(context));
    if (!input.success) {
      return context.json({ error: { code: 'settings.invalidInput' } }, 400);
    }
    const result = await holder.check(input.data.mcpToken);
    return result.ok ? context.json(result.value) : context.json({ error: result.error }, 422);
  });

  app.put('/api/settings', async (context) => {
    const input = settingsUpdateSchema.safeParse(await readJson(context));
    if (!input.success) {
      const issues = input.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
      return context.json({ error: { code: 'settings.invalidInput' }, issues }, 400);
    }
    const result = await holder.save(input.data);
    if (!result.ok) {
      return context.json({ error: result.error }, 422);
    }
    return context.json({ restartRequired: result.restartRequired, settings: toSettingsResponse(holder.state()) });
  });
}
