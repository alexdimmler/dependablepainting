/**
 * @typedef {Object} AppContext
 * @property {{ DB: { prepare(query: string): { bind(...params: any[]): { all(): Promise<{results:any[]}> }}} }} env
 */
interface D1PreparedStatement {
  bind(...params: any[]): {
    all(): Promise<{ results: any[] }>;
  };
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB: D1Database;
}
export interface AppContext {
  env: Env;
  req: Request;
}
interface LeadListRawQuery {
  q?: string;
  source?: string;
  city?: string;
  limit?: number | string;
  offset?: number | string;
}
interface LeadListParsedQuery {
  q?: string;
  source?: string;
  city?: string;
  limit?: number;
  offset?: number;
}
interface LeadsListSchema {
  tags: string[];
  summary: string;
  request: {
    query: {
      parse(raw: LeadListRawQuery): LeadListParsedQuery;
    };
  };
  responses: Record<string, any>;
}
export interface LeadRow {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  zip: string | null;
  service: string | null;
  page: string | null;
  source: string | null;
  session: string | null;
  message: string | null;
}

export class LeadsList {
  // Replaced zod-based schema with lightweight validator preserving .request.query.parse API.
  schema: LeadsListSchema = {
    tags: ["Leads"],
    summary: "List leads with filters and pagination",
    request: {
      query: {
        parse(raw: any): LeadListParsedQuery {
          const out: LeadListParsedQuery = {};
          const asOptString = (v: any) =>
            (typeof v === "string" && v.trim().length) ? v : undefined;
          out.q = asOptString(raw.q);
            out.source = asOptString(raw.source);
            out.city = asOptString(raw.city);
            // limit
            let limit = typeof raw.limit === "number" ? raw.limit :
                        (typeof raw.limit === "string" ? Number(raw.limit) : undefined);
            if (Number.isNaN(limit)) limit = undefined;
            if (limit === undefined) limit = 50;
            limit = Math.trunc(limit);
            if (limit < 1) limit = 1;
            if (limit > 200) limit = 200;
            out.limit = limit;
            // offset
            let offset = typeof raw.offset === "number" ? raw.offset :
                         (typeof raw.offset === "string" ? Number(raw.offset) : undefined);
            if (Number.isNaN(offset) || offset === undefined) offset = 0;
            offset = Math.trunc(offset);
            if (offset < 0) offset = 0;
            out.offset = offset;
            return out;
        }
      }
    },
    // Retained minimal response description (removed zod schemas to avoid dependency).
    responses: {
      "200": {
        description: "List of leads",
        content: {
          "application/json": {
            schema: {
              ok: true,
              items: "Lead[]"
            }
          }
        }
      }
    }
  };

  /**
   * @param {AppContext & { req: Request }} c
   */
  async handle(c: AppContext): Promise<{ ok: true; items: LeadRow[] }> {
    // Manually gather & validate query params (replacement for getValidatedData)
    const url = new URL(c.req.url);
    const qp = url.searchParams;
    const rawQuery: LeadListRawQuery = {
      q: qp.get("q") || undefined,
      source: qp.get("source") || undefined,
      city: qp.get("city") || undefined,
      limit: qp.get("limit") !== null ? Number(qp.get("limit")) : undefined,
      offset: qp.get("offset") !== null ? Number(qp.get("offset")) : undefined,
    };
    const q: LeadListParsedQuery = this.schema.request.query.parse(rawQuery);
    const filters: string[] = [];
    const args: any[] = [];
    if (q.source) { filters.push("source = ?"); args.push(q.source); }
    if (q.city)   { filters.push("city = ?");   args.push(q.city);   }
    if (q.q) {
      filters.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      args.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
    }
    const where: string = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const limit: number = Math.min((q.limit ?? 50), 200);
    const offset: number = q.offset ?? 0;
    const { results } = await c.env.DB.prepare(
      `SELECT id, name, email, phone, city, zip, service, page, source, session, message
       FROM leads ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).bind(...args, limit, offset).all() as { results: LeadRow[] };
    return { ok: true, items: results };
  }
}
