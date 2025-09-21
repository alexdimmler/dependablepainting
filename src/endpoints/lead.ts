import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";

interface PreparedStatement {
  bind: (...params: any[]) => {
    first: <T = any>() => Promise<T | null>;
  };
}
interface DB {
  prepare: (query: string) => PreparedStatement;
}
export interface AppContext {
  env: {
    DB: DB;
  };
}

export class LeadFetch extends OpenAPIRoute {
  schema = {
    tags: ["Leads"],
    summary: "Fetch a single lead by id",
    request: {
      params: z.object({
        id: Str({ description: "Lead ID" }),
      }),
    },
    responses: {
      "200": {
        description: "Returns a single lead",
        content: {
          "application/json": {
            schema: z.object({
              ok: z.literal(true),
              lead: z.object({
                id: z.any(),
                name: z.string().nullable().optional(),
                email: z.string().nullable().optional(),
                phone: z.string().nullable().optional(),
                city: z.string().nullable().optional(),
                zip: z.string().nullable().optional(),
                service: z.string().nullable().optional(),
                page: z.string().nullable().optional(),
                source: z.string().nullable().optional(),
                session: z.string().nullable().optional(),
                message: z.string().nullable().optional(),
              }),
            }),
          },
        },
      },
      "404": {
        description: "Lead not found",
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(false), error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: AppContext): Promise<any> {
    const data = await this.getValidatedData();
    const { id } = data.params;

    const lead = await c.env.DB.prepare(
      `SELECT id, name, email, phone, city, zip, service, page, source, session, message
       FROM leads WHERE id = ?`
    ).bind(id).first();

    if (!lead) {
      return Response.json({ ok: false, error: "not found" }, { status: 404 });
    }

    return { ok: true, lead };
  }
}