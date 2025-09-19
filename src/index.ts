// Cloudflare Email optional: removed direct import to avoid build error when 'cloudflare:email' types unavailable.

// Simple utility to build JSON Response
function json(
  data: unknown,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

async function parseJSON<T = unknown>(request: Request): Promise<T | null> {
  try { return await request.json() as T; } catch (_) { return null; }
}

interface LeadEventBody {
  // shared lead / event / tracking fields
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  zip?: string;
  service?: string;
  page?: string;
  session?: string;
  source?: string;
  description?: string;
  message?: string;
  company?: string;
  device?: string;
  country?: string;
  area?: string;
  referrer?: string;
  type?: string;
  scroll_pct?: number | string;
  duration_ms?: number | string;
  ts?: string;
  // marketing params
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
}

async function handleEstimate(env: Env, request: Request) {
  const body = (await parseJSON<LeadEventBody>(request)) || {};
  const leadData = {
    name: (body.name || '').trim(),
    email: (body.email || '').trim(),
    phone: (body.phone || '').trim(),
    city: (body.city || '').trim(),
    zip: (body.zip || '').trim(),
    service: (body.service || '').trim(),
    message: (body.description || body.message || '').trim(),
    page: (body.page || '/contact-form').trim(),
    session: (body.session || '').trim(),
    source: body.source || 'web',
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    gclid: body.gclid || '',
    ip: request.headers.get('CF-Connecting-IP') || '',
    ua: request.headers.get('User-Agent') || '',
    hp: (body.company || '').trim() // honeypot field
  };
  // Honeypot: silently succeed to not tip off bots.
  if (leadData.hp) {
    return json({ ok: true, success: true, lead_id: undefined, redirect: env.THANK_YOU_URL || '/thank-you' });
  }
  // Normalize phone (digits only) and basic length check (7-15 digits)
  leadData.phone = leadData.phone.replace(/[^0-9]/g, '');
  if (leadData.phone && (leadData.phone.length < 7 || leadData.phone.length > 15)) {
    return json({ error: 'Invalid phone number.' }, 400);
  }
  // Validation: only require name and phone now. Other fields optional.
  if (!leadData.name || !leadData.phone) {
    return json({ error: 'Name and phone are required.' }, 400);
  }
  let insertMeta;
  try {
    const res = await env.DB.prepare(
      `INSERT INTO leads (name, email, phone, city, zip, service, page, session, source, message)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      leadData.name,
      leadData.email,
      leadData.phone,
      leadData.city,
      leadData.zip,
      leadData.service,
      leadData.page,
      leadData.session,
      leadData.source,
      leadData.message
    ).run();
    insertMeta = res.meta;
  } catch (e) {
    console.error('D1 insert leads failed', e); // eslint-disable-line no-console
    return json({ error: 'Database operation failed.' }, 500);
  }
  // Emails (optional)
  try {
    if (env.SEB && env.SEB.send) {
      const subject = `New Lead: ${leadData.service || 'General'} — ${leadData.name || 'Unknown'}`;
      const text = [
        'You have a new lead from your website contact form!',
        '--------------------------------',
        `Name: ${leadData.name || '-'}`,
        `Email: ${leadData.email || '-'}`,
        `Phone: ${leadData.phone || '-'}`,
        `City: ${leadData.city || '-'}`,
        `Service of Interest: ${leadData.service || '-'}`,
        `Message: ${leadData.message || '-'}`,
        '--------------------------------',
        `Submitted from page: ${leadData.page || '-'}`,
        `UTM Source: ${leadData.utm_source || '-'}`,
        `Session ID: ${leadData.session || '-'}`,
        `IP: ${leadData.ip || '-'}`,
        `UA: ${leadData.ua || '-'}`
      ].join('\n');
      const from = env.FROM_ADDR || 'no-reply@dependablepainting.work';
      const to = env.ADMIN_EMAIL || env.OWNER_EMAIL || env.TO_ADDR || 'just-paint-it@dependablepainting.work';
      // Unified send (avoid EmailMessage class to prevent import error)
      try {
        await env.SEB.send({ from, to, subject, content: text });
      } catch (_) { /* swallow admin email errors */ }
    }
  } catch (e) {
    console.warn('Admin email send failed', e); // eslint-disable-line no-console
  }
  try {
    const to = (leadData.email || '').trim();
    if (to && env.SEB && env.SEB.send) {
      const subject = `Thanks for contacting ${env.SITE_NAME || 'Dependable Painting'}`;
      const html = `<p>Hi ${leadData.name || 'there'},</p><p>We received your request and will be in touch within the hour.</p><p>If you need us now, call <strong>(251) 525-4405</strong>.</p><p>— ${env.SITE_NAME || 'Dependable Painting'}</p>`;
      const fromAddr = env.FROM_ADDR || 'no-reply@dependablepainting.work';
      try {
        await env.SEB.send({ from: fromAddr, to, subject, html });
      } catch (_) { /* swallow auto-reply errors */ }
    }
  } catch (e) {
    console.warn('Auto-reply email send failed', e); // eslint-disable-line no-console
  }
  const lead_id = insertMeta?.last_row_id ? String(insertMeta.last_row_id) : undefined;
  return json({ ok: true, success: true, lead_id, redirect: env.THANK_YOU_URL || '/thank-you' });
}

// Generic form submission (lightweight, stores as lead_events type=form_submit and optionally email notify)
async function handleForm(env: Env, request: Request) {
  const body = (await parseJSON<LeadEventBody>(request)) || {};
  const ts = new Date().toISOString();
  const page = (body.page || '/').toString().slice(0, 300);
  const session = (body.session || '').toString().slice(0, 120);
  const service = (body.service || '').toString().slice(0, 120);
  const source = (body.source || '').toString().slice(0, 120);
  try {
    await env.DB.prepare(
      `INSERT INTO lead_events (ts, day, hour, type, page, service, source, device, city, country, zip, area, session, scroll_pct, duration_ms, referrer, utm_source, utm_medium, utm_campaign, gclid)
       VALUES (?, date(?), strftime('%H', ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ts, ts, ts,
      'form_submit',
      page,
      service || null,
      source || null,
      body.device || null,
      body.city || null,
      body.country || null,
      body.zip || null,
      body.area || null,
      session || null,
      0,
      0,
      body.referrer || null,
      body.utm_source || null,
      body.utm_medium || null,
      body.utm_campaign || null,
      body.gclid || null
    ).run();
  } catch (e) {
    return json({ error: 'db error' }, 500);
  }
  return json({ ok: true });
}

// Call event (e.g., phone click) stored as type=click_call
async function handleCall(env: Env, request: Request) {
  const body = (await parseJSON<LeadEventBody>(request)) || {};
  const ts = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO lead_events (ts, day, hour, type, page, service, source, device, city, country, zip, area, session, scroll_pct, duration_ms, referrer, utm_source, utm_medium, utm_campaign, gclid)
       VALUES (?, date(?), strftime('%H', ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ts, ts, ts,
      'click_call',
      body.page || '/',
      body.service || null,
      body.source || null,
      body.device || null,
      body.city || null,
      body.country || null,
      body.zip || null,
      body.area || null,
      body.session || null,
      0,
      0,
      body.referrer || null,
      body.utm_source || null,
      body.utm_medium || null,
      body.utm_campaign || null,
      body.gclid || null
    ).run();
  } catch (e) {
    return json({ error: 'db error' }, 500);
  }
  return json({ ok: true });
}

// Basic stats aggregation (last 30 days counts by type and total leads)
async function handleStats(env: Env) {
  const thirty = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  try {
    const events = await env.DB.prepare(
      `SELECT type, COUNT(*) as cnt FROM lead_events WHERE ts >= ? GROUP BY type ORDER BY cnt DESC`
    ).bind(thirty).all<{ type: string; cnt: number }>(); // added generic
    const leads = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM leads WHERE rowid IN (SELECT id FROM leads WHERE 1)`
    ).all<{ cnt: number }>(); // added generic
    return json({ ok: true, event_counts: events.results || [], total_leads: (leads.results?.[0]?.cnt) || 0 });
  } catch (e) {
    return json({ error: 'db error' }, 500);
  }
}

// Chat history fetch (last N messages for a session)
async function handleChatHistory(env: Env, request: Request) {
  const url = new URL(request.url);
  const session = url.searchParams.get('session') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100);
  if (!session) return json({ error: 'session required' }, 400);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, ts, question, answer, ai_provider, page FROM chat_log WHERE session = ? ORDER BY id DESC LIMIT ?`
    ).bind(session, limit).all();
    return json({ ok: true, items: results });
  } catch (e) {
    return json({ error: 'db error' }, 500);
  }
}

async function handleChat(env: Env, request: Request) {
  const body = (await parseJSON<LeadEventBody>(request)) || {};
  const userMsg = (body.message || '').toString().slice(0, 8000);
  if (!userMsg) return json({ error: 'message required' }, 400);
  const systemPrompt = `You are Paint Guru, the expert operator and assistant for Dependable Painting. You:
- Only answer with facts about painting, surfaces, materials, prep, application, and the painting industry.
- Are deeply knowledgeable about all painting services, surfaces (wood, drywall, brick, siding, cabinets, etc.), materials (paints, primers, stains, finishes), and the company Dependable Painting.
- Serve Baldwin & Mobile County, AL, and know the local context.
- Always clarify or ask follow-up questions if the user's request is unclear.
- For scheduling or quotes, suggest calling (251) 525-4405.
- If asked about your company, mention Dependable Painting's reputation for quality, reliability, and customer satisfaction.
- If you do not know the answer, say so and offer to connect the user with a human expert.
- Log every chat for quality and improvement.
- Always be helpful, concise, and professional.`;
  let reply = '';
  let aiProvider = '';
  try {
    if (env.AI) {
      const aiResp = await env.AI.run({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ],
        model: env.AI_MODEL || 'gpt-4o',
        max_tokens: 512,
        temperature: env.AI_TEMP ? Number(env.AI_TEMP) : 0.3
      });
      reply = aiResp.choices?.[0]?.message?.content || '';
      aiProvider = 'workers-ai';
    } else if (env.OPENAI_API_KEY) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
          ],
          temperature: env.OPENAI_TEMP ? Number(env.OPENAI_TEMP) : 0.3,
          max_tokens: 512
        })
      });
      if (!resp.ok) {
        const tx = await resp.text().catch(() => '');
        return json({ error: `openai_error:${resp.status} ${tx.slice(0, 300)}` }, 502);
      }
      const data = await resp.json();
      reply = data?.choices?.[0]?.message?.content || '';
      aiProvider = 'openai';
    } else {
      return json({ error: 'No AI provider configured' }, 500);
    }
    try {
      await env.DB.prepare(
        `INSERT INTO chat_log (ts, session, question, answer, ai_provider, user_agent, page) VALUES (strftime('%Y-%m-%dT%H:%M:%fZ','now'),?,?,?,?,?,?)`
      ).bind(
        body.session || '',
        userMsg,
        reply,
        aiProvider,
        request.headers.get('User-Agent') || '',
        body.page || ''
      ).run();
    } catch (e) { }
    return json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `ai_fail:${msg}` }, 502);
  }
}

// Tracking event ingestion
// Accepts: { type, page?, service?, source?, device?, city?, country?, zip?, area?, session?, scroll_pct?, duration_ms?, referrer?, utm_source?, utm_medium?, utm_campaign?, gclid?, ts? }
// If ts omitted, server time used. Stores row in lead_events and optionally forwards lightweight event to GA4.
async function handleTrack(env: Env, request: Request) {
  const body = (await parseJSON<LeadEventBody>(request)) || {};
  const clientTs = typeof body.ts === 'string' ? body.ts : null;
  const now = clientTs ? new Date(clientTs) : new Date();
  const iso = now.toISOString();
  const day = iso.slice(0, 10);
  const hour = iso.slice(11, 13);
  const record = {
    type: (body.type || 'event').toString().slice(0, 50),
    page: body.page || '',
    service: body.service || '',
    source: body.source || '',
    device: body.device || '',
    city: body.city || '',
    country: body.country || '',
    zip: body.zip || '',
    area: body.area || '',
    session: body.session || '',
    scroll_pct: Number.isFinite(Number(body.scroll_pct)) ? Number(body.scroll_pct) : 0,
    duration_ms: Number.isFinite(Number(body.duration_ms)) ? Number(body.duration_ms) : 0,
    referrer: body.referrer || '',
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    gclid: body.gclid || ''
  };
  try {
    await env.DB.prepare(
      `INSERT INTO lead_events (ts, day, hour, type, page, service, source, device, city, country, zip, area, session, scroll_pct, duration_ms, referrer, utm_source, utm_medium, utm_campaign, gclid)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      iso,
      day,
      hour,
      record.type,
      record.page,
      record.service,
      record.source,
      record.device,
      record.city,
      record.country,
      record.zip,
      record.area,
      record.session,
      record.scroll_pct,
      record.duration_ms,
      record.referrer,
      record.utm_source,
      record.utm_medium,
      record.utm_campaign,
      record.gclid
    ).run();
    if (env.DB_2) {
      await env.DB_2.prepare(
        `INSERT INTO lead_events (ts, day, hour, type, page, service, source, device, city, country, zip, area, session, scroll_pct, duration_ms, referrer, utm_source, utm_medium, utm_campaign, gclid)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        iso,
        day,
        hour,
        record.type,
        record.page,
        record.service,
        record.source,
        record.device,
        record.city,
        record.country,
        record.zip,
        record.area,
        record.session,
        record.scroll_pct,
        record.duration_ms,
        record.referrer,
        record.utm_source,
        record.utm_medium,
        record.utm_campaign,
        record.gclid
      ).run();
    }
  } catch (e) {
    console.error('D1 insert lead_events failed', e); // eslint-disable-line no-console
    return json({ error: 'Database operation failed.' }, 500);
  }
  const measurement_id = 'G-CLK9PTRD5N';
  const api_secret = env.GA4_API_SECRET || '';
  const client_id = body.session || crypto.randomUUID();
  const ga4Params: Record<string, unknown> = {
    page_location: record.page || 'https://dependablepainting.work',
    page_referrer: record.referrer || '',
    session_id: record.session || '',
    engagement_time_msec: record.duration_ms ? String(record.duration_ms) : undefined,
    scroll_pct: record.scroll_pct,
    city: record.city,
    zip: record.zip,
    area: record.area
  };
  for (const k in ga4Params) {
    if (ga4Params[k] === undefined) delete ga4Params[k];
  }
  const ga4Payload = { client_id, events: [{ name: body.type || 'event', params: ga4Params }] };
  try {
    if (api_secret) {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`;
      const resp = await fetch(url, { method: 'POST', body: JSON.stringify(ga4Payload), headers: { 'Content-Type': 'application/json' } });
      if (!resp.ok) {
        const tx = await resp.text().catch(() => '');
        return json({ error: `GA4 error: ${resp.status} ${tx.slice(0, 300)}` }, 502);
      }
    }
  } catch (e) { }
  return json({ ok: true });
}

// Not implemented placeholder JSON helper
function notImpl() { return json({ success: false, message: 'Not implemented yet' }, 501); }

async function serveStaticAsset(env: Env, pathname: string) {
  // Try to map to public directory (simple implementation using manifest-less fetch).
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (!filePath.includes('.')) {
    // attempt directory -> /file.html
    if (!filePath.endsWith('/')) filePath += '/';
    filePath += 'index.html';
  }
  const url = new URL(filePath, 'http://local');
  // Use the ASSETS manifest facility if Wrangler provides env.ASSETS, else fetch from __STATIC_CONTENT
  // Simpler: rely on Workers Sites style binding is not configured; fallback 404.
  // Since wrangler "assets" config serves automatically in production, we can 404 here and let upstream handle in real deploy.
  return new Response('Not Found', { status: 404 });
}

interface EmailService {
  send(payload: { from: string; to: string; subject: string; content?: string; html?: string }): Promise<any>;
}

// Minimal D1 type stubs (remove if you install @cloudflare/workers-types)
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }>;
  run<T = unknown>(): Promise<{ success: boolean; meta: any }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  DB: D1Database;
  DB_2?: D1Database;
  SEB?: EmailService;
  AI?: { run(opts: any): Promise<any> };
  AI_MODEL?: string;
  AI_TEMP?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_TEMP?: string;
  THANK_YOU_URL?: string;
  FROM_ADDR?: string;
  ADMIN_EMAIL?: string;
  OWNER_EMAIL?: string;
  TO_ADDR?: string;
  SITE_NAME?: string;
  GA4_API_SECRET?: string;
}

// Minimal fallback definition for Cloudflare Workers ExecutionContext to satisfy TypeScript
// Remove if you add:  npm i -D @cloudflare/workers-types  and a /// <reference types="@cloudflare/workers-types" />
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) { // eslint-disable-line no-unused-vars
    const { pathname } = new URL(request.url);
    const method = request.method.toUpperCase();

    // API routing
    if (pathname === '/api/estimate' && method === 'POST') return handleEstimate(env, request);
    if (pathname === '/api/form' && method === 'POST') return handleForm(env, request);
    if (pathname === '/api/call' && method === 'POST') return handleCall(env, request);
    if (pathname === '/api/stats' && method === 'GET') return handleStats(env);
    if (pathname === '/api/chat/history' && method === 'GET') return handleChatHistory(env, request);
    if (pathname === '/api/event' && method === 'POST') return handleTrack(env, request); // alias
    if (pathname.startsWith('/api/lead/') && method === 'GET') {
      // /api/lead/:id
      const id = pathname.split('/').pop();
      if (!id) return json({ error: 'id required' }, 400);
      try {
        const row = await env.DB.prepare(
          `SELECT id, name, email, phone, city, zip, service, page, source, session, message FROM leads WHERE id = ?`
        ).bind(id).first();
        if (!row) return json({ ok: false, error: 'not found' }, 404);
        return json({ ok: true, lead: row });
      } catch (e) {
        return json({ error: 'db error' }, 500);
      }
    }
    if (pathname === '/api/leads' && method === 'GET') {
      const url = new URL(request.url);
      const q = url.searchParams.get('q');
      const source = url.searchParams.get('source');
      const city = url.searchParams.get('city');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
      const filters = [];
      const args = [];
      if (source) { filters.push('source = ?'); args.push(source); }
      if (city) { filters.push('city = ?'); args.push(city); }
      if (q) { filters.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      try {
        const { results } = await env.DB.prepare(
          `SELECT id, name, email, phone, city, zip, service, page, source, session, message
           FROM leads ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
        ).bind(...args, limit, offset).all();
        return json({ ok: true, items: results });
      } catch (e) {
        return json({ error: 'db error' }, 500);
      }
    }
    if (pathname === '/api/chat' && method === 'POST') return handleChat(env, request);
    if (pathname === '/api/charge' && method === 'POST') return notImpl();
    if (pathname === '/api/track' && method === 'POST') return handleTrack(env, request);
    if (pathname === '/api/lead-status' && method === 'POST') return notImpl();
    if (pathname === '/api/job' && method === 'POST') return notImpl();
    // legacy placeholders replaced above for stats & call
    if (pathname === '/api/geo/classify' && method === 'GET') return notImpl();
    if (pathname === '/api/health' && method === 'GET') return json({ ok: true, ts: Date.now() });

    // Static asset fallback (Wrangler will handle real asset serving via "assets" config). 404 placeholder here.
    return serveStaticAsset(env, pathname);
  }
};

