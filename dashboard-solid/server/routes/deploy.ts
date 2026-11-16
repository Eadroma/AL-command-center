/**
 * Deployment routes. Every write is refused while settings.json has deploy.enabled false; the service decides.
 * Deploying names the profile revision it was asked for: a newer save in between is refused (save → preview → deploy).
 */
import type { Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { DeployFailure } from '../../shared/deploy.ts';
import { controlRequestSchema, deployRequestSchema, partyRequestSchema, previewRequestSchema, rollbackRequestSchema } from '../../shared/deploy.ts';
import type { DeployService } from '../deploy/service.ts';

async function body<T>(context: Context, schema: z.ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await context.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

const STATUS: Readonly<Record<string, ContentfulStatusCode>> = {
  'deploy.disabled': 403,
  'deploy.busy': 409,
  'deploy.staleProfile': 409,
  'deploy.notPreviewed': 409,
};

function refuse(context: Context, error: DeployFailure): Response {
  return context.json({ error }, STATUS[error.code] ?? 422);
}

export function deployRoutes(app: Hono, service: DeployService): void {
  app.get('/api/deployments', (context) => context.json(service.state()));

  app.post('/api/deploy', async (context) => {
    const input = await body(context, deployRequestSchema);
    if (input === null) {
      return context.json({ error: { code: 'deploy.invalidRequest' } }, 400);
    }
    const outcome = await service.deploy(input.character, input.revision, input.prepareOnly);
    return outcome.ok ? context.json(outcome.deployment) : refuse(context, outcome.error);
  });

  app.post('/api/deploy/party', async (context) => {
    const input = await body(context, partyRequestSchema);
    if (input === null) {
      return context.json({ error: { code: 'deploy.invalidRequest' } }, 400);
    }
    const outcome = await service.deployParty(input.revision);
    return outcome.ok ? context.json(outcome.result) : refuse(context, outcome.error);
  });

  // POST because it builds with the profile revision named in the body; it changes nothing.
  app.post('/api/deploy/preview', async (context) => {
    const input = await body(context, previewRequestSchema);
    if (input === null) {
      return context.json({ error: { code: 'deploy.invalidRequest' } }, 400);
    }
    const outcome = await service.preview(input.revision);
    return outcome.ok ? context.json(outcome.result) : refuse(context, outcome.error);
  });

  app.get('/api/deploy/history', async (context) => context.json({ backups: await service.history() }));

  app.post('/api/deploy/rollback', async (context) => {
    const input = await body(context, rollbackRequestSchema);
    if (input === null) {
      return context.json({ error: { code: 'deploy.invalidRequest' } }, 400);
    }
    const outcome = await service.rollback(input.id);
    return outcome.ok ? context.json(outcome.deployment) : refuse(context, outcome.error);
  });

  app.post('/api/control', async (context) => {
    const input = await body(context, controlRequestSchema);
    if (input === null) {
      return context.json({ error: { code: 'deploy.invalidRequest' } }, 400);
    }
    const outcome = await service.control(input.character, input.action);
    return outcome.ok ? context.json(outcome.deployment) : refuse(context, outcome.error);
  });
}
