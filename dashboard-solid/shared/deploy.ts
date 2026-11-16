/** Deployment state and results, shared by the server and the UI. Messages are codes the UI translates. */
import { z } from 'zod';

export const DEPLOY_STAGES = [
  'idle', 'building', 'checking', 'choosingSlot', 'backingUp', 'uploading', 'verifying', 'reloading',
  'prepared', 'reloadRequested', 'startRequested', 'stopRequested', 'rollbackRequested', 'failed',
] as const;

export const deployErrorSchema = z.object({ code: z.string(), detail: z.string().optional() });

export const deploymentSchema = z.object({
  stage: z.enum(DEPLOY_STAGES),
  busy: z.boolean(),
  /** Why the last operation failed (stage "failed"). */
  error: deployErrorSchema.nullable(),
  slot: z.string().nullable(),
  /** SHA-256 of the uploaded code (bundle + telemetry). */
  hash: z.string().nullable(),
  /** Profile revision the bundle was built from. */
  profileRevision: z.number().nullable(),
  /** Game report after the last control: is the character online, is CODE running. */
  online: z.boolean().nullable(),
  codeRunning: z.boolean().nullable(),
  at: z.string(),
});

export const deploymentsSchema = z.object({
  /** settings.json deploy.enabled: false while dashboard-v2 stays the only deployer. */
  enabled: z.boolean(),
  characters: z.record(z.string(), deploymentSchema),
  /** Revision last previewed successfully: the only one that can be deployed (Save → Preview → Deploy). */
  previewedRevision: z.number().nullable(),
});

export const partyResultSchema = z.object({
  deployed: z.array(z.string()).readonly(),
  failures: z.array(z.object({ character: z.string(), error: deployErrorSchema })).readonly(),
});

export const deployRequestSchema = z.object({ character: z.string().min(1).max(40), revision: z.number().int().positive(), prepareOnly: z.boolean().default(false) });
export const partyRequestSchema = z.object({ revision: z.number().int().positive() });
export const rollbackRequestSchema = z.object({ id: z.string().regex(/^[a-f0-9-]{36}$/) });
export const previewRequestSchema = z.object({ revision: z.number().int().positive() });
export const controlRequestSchema = z.object({ character: z.string().min(1).max(40), action: z.enum(['start', 'stop', 'status']) });

export type Deployment = z.infer<typeof deploymentSchema>;
export type Deployments = z.infer<typeof deploymentsSchema>;
export type DeployFailure = z.infer<typeof deployErrorSchema>;
export type PartyResult = z.infer<typeof partyResultSchema>;

export const previewChangeSchema = z.object({ key: z.string(), before: z.unknown(), after: z.unknown() });

export const previewCharacterSchema = z.object({
  name: z.string(),
  script: z.string(),
  slot: z.string().nullable(),
  /** slot: compared with the deployed CODE; noSlot: never deployed; unreadable: the slot's settings could not be read. */
  comparison: z.enum(['slot', 'noSlot', 'unreadable']),
  /** Script or shared modules changed since the deployed version (null when unknown). */
  sourceChanged: z.boolean().nullable(),
  changes: z.array(previewChangeSchema).readonly(),
  /** Builder warnings, in dashboard-v2's English wording; the UI translates the known ones. */
  warnings: z.array(z.string()).readonly(),
  /** Why the bundle could not be built (same wording rule). */
  error: z.string().nullable(),
});

export const previewResultSchema = z.object({ revision: z.number(), characters: z.array(previewCharacterSchema).readonly() });

export const backupSchema = z.object({
  id: z.string(),
  character: z.string(),
  slot: z.string(),
  name: z.string(),
  at: z.string(),
  bytes: z.number(),
  hash: z.string(),
});

export const historySchema = z.object({ backups: z.array(backupSchema).readonly() });

export type PreviewChange = z.infer<typeof previewChangeSchema>;
export type PreviewCharacter = z.infer<typeof previewCharacterSchema>;
export type PreviewResult = z.infer<typeof previewResultSchema>;
export type Backup = z.infer<typeof backupSchema>;
