// Minimal shim for OpenAPIRoute to satisfy the import in endpoints.
// Provides basic Zod validation support based on the route's schema definition.
export interface ValidationResult<TBody = any> {
  body: TBody;
}

export abstract class OpenAPIRoute {
  // Route classes (like EstimateCreate) assign a schema object.
  schema: any;

  // Internal body payload set before handle() is invoked (framework integration can set this).
  private _rawBody: any;

  // Allow external code/tests to inject a body for validation.
  setBody(body: any) {
    this._rawBody = body;
  }

  // Performs validation using the Zod schema if present.
  async getValidatedData(): Promise<ValidationResult> {
    const bodySchema =
      this.schema?.request?.body?.content?.["application/json"]?.schema;

    if (bodySchema && typeof bodySchema.safeParse === "function") {
      const parsed = bodySchema.safeParse(this._rawBody);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e: { message: any; }) => e.message).join("; ");
        throw new Error(msg || "Invalid request body");
      }
      return { body: parsed.data };
    }
    return { body: this._rawBody ?? {} };
  }

  // Subclasses must implement handle().
  abstract handle(c: any): Promise<any>;
}
