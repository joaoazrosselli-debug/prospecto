import { z } from 'zod';
import { StudioFailure, type StudioAccess } from './studio-auth';
import { getCode } from './studio-code';
import { type StudioRow, unpackRecord } from './studio-records';
import { validId } from './studio-validation.js';
import { createPrompt, publicBrief } from '../public/landing.js';
import { productionPlan, productionRequest, MANUAL_REVIEW_CHECKS } from '../public/production-plan.js';
import { auditDelivery } from './delivery-audit';

const scopes = ['draft', 'active'] as const;
type Scope = typeof scopes[number];
const reviewSchema = z.object({
  scope: z.enum(scopes),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  checks: z.object(Object.fromEntries(MANUAL_REVIEW_CHECKS.map(([id]) => [id, z.boolean()]))).strict(),
  note: z.string().max(2000).default(''),
}).strict();

async function context(access: StudioAccess, id: string, selected?: string) {
  if (!validId(id)) throw new StudioFailure(400, 'Empresa inválida.');
  if (selected && !scopes.includes(selected as Scope)) throw new StudioFailure(400, 'Escolha rascunho ou página atual.');
  const row = await access.db.prepare("SELECT * FROM studio_records WHERE key=? AND kind='lead'").bind('lead:' + id).first<StudioRow>();
  if (!row) throw new StudioFailure(404, 'Empresa não encontrada.');
  const [code, assets, settings] = await Promise.all([
    getCode(access, id),
    access.db.prepare('SELECT id,name,mime,size,role,alt FROM studio_assets WHERE lead_id=? ORDER BY id').bind(id).all(),
    access.db.prepare("SELECT data FROM studio_records WHERE kind='settings' LIMIT 1").first<{ data: string }>(),
  ]);
  const scope: Scope = (selected as Scope) || (code.revision ? 'draft' : 'active');
  if (scope === 'draft' && !code.revision) throw new StudioFailure(404, 'Ainda não há rascunho salvo. Salve uma versão no Editor de código.');
  const lead = { ...unpackRecord(row), assets: assets.results }, files = scope === 'draft' ? code.files : code.active;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ files, brief: publicBrief(lead), assets: assets.results })));
  const fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return { row, lead, files, scope, code, fingerprint, settings: settings ? JSON.parse(settings.data) : {} };
}

export async function getProduction(access: StudioAccess, id: string, scope?: string) {
  const c = await context(access, id, scope);
  const saved = await access.db.prepare('SELECT id,fingerprint,data,created_at FROM studio_delivery_reviews WHERE lead_id=? AND scope=? ORDER BY seq DESC LIMIT 1').bind(id, c.scope).first<any>();
  const review = saved ? { id: saved.id, ...JSON.parse(saved.data), createdAt: saved.created_at, current: saved.fingerprint === c.fingerprint } : null;
  return {
    lead: { id, name: c.lead.name },
    source: { scope: c.scope, revision: c.scope === 'draft' ? c.code.revision : c.row.revision, leadRevision: c.row.revision, hasDraft: !!c.code.revision, fingerprint: c.fingerprint },
    plan: productionPlan(c.lead, { hasDraft: !!c.code.revision, reviewed: !!review?.current && review.status === 'reviewed' }),
    automatic: auditDelivery(c.files, c.lead),
    review,
    manualChecks: MANUAL_REVIEW_CHECKS,
    request: productionRequest(c.lead, createPrompt(c.lead, c.settings)),
    runtime: { mode: 'chat_mcp', backgroundRunning: false, apiBillingConnected: false },
  };
}

export async function saveDeliveryReview(access: StudioAccess, id: string, raw: unknown) {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) throw new StudioFailure(400, 'Preencha as conferências da equipe e uma observação de até 2.000 caracteres.');
  const input = parsed.data, c = await context(access, id, input.scope);
  if (input.fingerprint !== c.fingerprint) throw new StudioFailure(409, 'O código, a ficha ou os materiais mudaram. Atualize a análise e confira esta versão antes de salvar.', { code: 'review_conflict' });
  const automatic = auditDelivery(c.files, c.lead);
  const complete = MANUAL_REVIEW_CHECKS.every(([key]) => input.checks[key] === true);
  const data = { checks: input.checks, note: input.note.trim(), automatic, status: complete && !automatic.blockers ? 'reviewed' : 'pending', attestation: 'team_checklist' };
  const now = new Date().toISOString(), reviewId = crypto.randomUUID();
  const result = await access.db.prepare(`INSERT INTO studio_delivery_reviews(id,lead_id,scope,fingerprint,data,created_at,created_by)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_records WHERE key=? AND revision=?)
    AND (?='active' OR EXISTS(SELECT 1 FROM studio_code_drafts WHERE lead_id=? AND revision=?))`)
    .bind(reviewId, id, c.scope, c.fingerprint, JSON.stringify(data), now, access.user.userId, 'lead:' + id, c.row.revision, c.scope, id, c.code.revision).run();
  if (!result.meta.changes) throw new StudioFailure(409, 'Esta versão mudou durante a revisão. Atualize e confira novamente.', { code: 'review_conflict' });
  return { saved: true, id: reviewId, status: data.status, applied: false, published: false };
}
