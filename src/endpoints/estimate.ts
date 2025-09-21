// Requires dependency: npm install zod
import { z } from "zod";
interface LeadCreateBody {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  zip?: string;
  service?: string;
  message?: string;
  page?: string;
  source?: string;
  session?: string;
}

interface ValidatedData {
  body: LeadCreateBody;
}

interface DBRunMeta {
  last_row_id: number;
}

interface DBRunResult {
  meta: DBRunMeta;
}

interface PreparedStatement {
  bind(...values: (string | null)[]): PreparedStatement;
  run(): Promise<DBRunResult>;
}

interface DB {
  prepare(sql: string): PreparedStatement;
}

interface Env {
  DB: DB;
}

interface Context {
  enDB: any;
  env: Env;
}

interface EstimateCreateResponse {
  ok: true;
  lead_id: string;
}

export class EstimateCreate {
  schema = {
    tags: ["Leads"],
    summary: "Create a lead from the contact form",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(1).max(120).optional(),
              email: z.string().email().optional(),
              phone: z.string().min(3).max(40).optional(),
              city: z.string().max(80).optional(),
              zip: z.string().max(20).optional(),
              service: z.string().max(80).optional(),
              message: z.string().max(2000).optional(),
              page: z.string().default("/contact-form").optional(),
              source: z.string().max(120).optional(),
              session: z.string().max(120).optional()
            }).refine(v => (v.phone || v.email), {
              message: "phone or email required"
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Lead created",
        content: {
          "application/json": {
            schema: z.object({
              ok: z.literal(true),
              lead_id: z.string()
            }),
          },
        },
      },
      "400": {
        description: "Invalid payload",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
    },
  };
  getValidatedData: any;

  async handle(c: Context): Promise<EstimateCreateResponse> {
    // Validate request
    const data = await this.getValidatedData() as ValidatedData;
    const b: LeadCreateBody = data.body;

    // Insert into leads
    // Adjust the SQL/columns if your migration differs.
    const res: DBRunResult = await c.enDB.prepare(
      `INSERT INTO leads
       (name,email,phone,city,zip,service,page,session,source,message)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        b.name ?? null,
        b.email ?? null,
        b.phone ?? null,
        b.city ?? null,
        b.zip ?? null,
        b.service ?? null,
        b.page ?? "/contact-form",
        b.session ?? null,
        b.source ?? "",
        b.message ?? null
      )
      .run();

    const leadId: string = String(res.meta.last_row_id);

    // Log event for attribution
    const ts: string = new Date().toISOString();
    await c.enDB.prepare(
      "INSERT INTO lead_events (ts, day, hour, type, page, service, source, device, city, country, zip, area, session, scroll_pct) " +
      "VALUES (?, date(?), strftime('%H', ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        ts, ts, ts,
        "lead_submitted",
        b.page ?? "/contact-form",
        b.service ?? null,
        b.source ?? "",
        null, // device
        b.city ?? null,
        null, // country
        b.zip ?? null,
        null, // area
        b.session ?? null,
        0
      )
      .run();

    return {
      ok: true,
      lead_id: leadId,
    };
  }
}
