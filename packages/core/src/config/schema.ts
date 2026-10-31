import { z } from "zod";
import { TARGET_IDS } from "../targets.js";

export const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

const TargetIdSchema = z.enum(TARGET_IDS);

export const EndpointSchema = z
  .string()
  .regex(
    new RegExp(`^(${HTTP_METHODS.join("|")})\\s+/\\S*$`),
    'expected "<verb> /path" with a lowercase HTTP verb, e.g. "get /projects/{project_id}"',
  );

export const SchemaRefSchema = z
  .string()
  .regex(/^#\/components\/schemas\/[^/]+$/, 'expected a schema reference like "#/components/schemas/Pet"');

const SkipSchema = z.union([z.boolean(), z.array(TargetIdSchema)]);

export const MethodConfigSchema = z.strictObject({
  endpoint: EndpointSchema,
  paginated: z.boolean().optional(),
  pagination: z.string().optional(),
  stream: z
    .union([
      z.boolean(),
      z.strictObject({ when_param: z.string().optional(), event_type: SchemaRefSchema.optional() }),
    ])
    .optional(),
  unwrap: z.string().optional(),
  idempotent: z.boolean().optional(),
  deprecated: z.union([z.boolean(), z.string()]).optional(),
  positional_params: z.array(z.string()).optional(),
  body_param_name: z.string().optional(),
  response: z.enum(["json", "binary", "text"]).optional(),
  skip: SkipSchema.optional(),
  docs: z
    .strictObject({ summary: z.string().optional(), examples: z.array(z.string()).optional() })
    .optional(),
});

export const MethodSchema = z.union([EndpointSchema, MethodConfigSchema]);

const TerraformResourceSchema = z.strictObject({
  resource: z.boolean().optional(),
  data_source: z.boolean().optional(),
  name: z.string().optional(),
  id_attribute: z.string().optional(),
  import_id: z.string().optional(),
  update_strategy: z.enum(["patch", "put"]).optional(),
  sensitive: z.array(z.string()).optional(),
});

const McpResourceSchema = z.strictObject({
  tools: z
    .strictObject({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional() })
    .optional(),
  read_only: z.boolean().optional(),
});

const CliResourceSchema = z.strictObject({ name: z.string().optional(), hidden: z.boolean().optional() });

export const ResourceSchema = z.strictObject({
  description: z.string().optional(),
  models: z.record(z.string(), SchemaRefSchema).optional(),
  methods: z.record(z.string(), MethodSchema).optional(),
  get subresources() {
    return z.record(z.string(), ResourceSchema).optional();
  },
  skip: SkipSchema.optional(),
  terraform: z.union([z.boolean(), TerraformResourceSchema]).optional(),
  mcp: z.union([z.boolean(), McpResourceSchema]).optional(),
  cli: z.union([z.boolean(), CliResourceSchema]).optional(),
});

const ParamRefSchema = z.strictObject({
  param: z.string(),
  in: z.enum(["query", "header", "body"]).optional(),
});

export const PaginationSchemeSchema = z.strictObject({
  name: z.string().min(1),
  type: z.enum(["cursor", "cursor_from_item", "next_url", "offset", "page_number"]),
  request: z.record(z.string(), ParamRefSchema).optional(),
  response: z
    .record(z.string(), z.union([z.string(), z.strictObject({ from_last_item: z.string() })]))
    .optional(),
});

const StatusSchema = z.union([
  z.number().int().min(100).max(599),
  z.string().regex(/^([1-5]\d\d|[1-5]xx)$/, 'expected a status code like 429 or a range like "5xx"'),
]);

const ClientOptionSchema = z.strictObject({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().optional(),
  env: z.string().optional(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  header: z.string().optional(),
  auth: z.strictObject({ scheme: z.string() }).optional(),
});

const ClientSchema = z.strictObject({
  options: z.record(z.string(), ClientOptionSchema).optional(),
  retries: z
    .strictObject({
      max: z.number().int().min(0),
      backoff: z.enum(["exponential", "constant"]).optional(),
      initial_ms: z.number().int().positive().optional(),
      max_ms: z.number().int().positive().optional(),
      retry_on: z.array(StatusSchema).optional(),
    })
    .optional(),
  timeout_ms: z.number().int().positive().optional(),
  idempotency: z
    .strictObject({ header: z.string(), methods: z.array(z.enum(HTTP_METHODS)).optional() })
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const AuthSchemeSchema = z.looseObject({
  type: z.enum(["http", "apiKey", "oauth2", "openIdConnect"]),
});

const AuthSchema = z.strictObject({
  default: z.array(z.string()).optional(),
  schemes: z.record(z.string(), AuthSchemeSchema).optional(),
});

const EditionSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected an edition like "2026-11"');

const OptionsSchema = z.record(z.string(), z.unknown());

const targetBase = {
  output: z.string().optional(),
  edition: EditionSchema.optional(),
  options: OptionsSchema.optional(),
};

export const TargetsSchema = z.strictObject({
  typescript: z
    .strictObject({
      ...targetBase,
      package: z.string(),
      runtime: z.strictObject({ min_node: z.string().optional() }).optional(),
    })
    .optional(),
  go: z.strictObject({ ...targetBase, module: z.string() }).optional(),
  python: z.strictObject({ ...targetBase, package: z.string() }).optional(),
  mcp: z
    .strictObject({
      ...targetBase,
      package: z.string(),
      tool_mode: z.enum(["endpoints", "code"]).optional(),
      transports: z.array(z.enum(["stdio", "streamable_http"])).optional(),
      client_profiles: z.array(z.string()).optional(),
      code_execution: z
        .strictObject({ runtime: z.enum(["deno"]), allow_hosts: z.array(z.string()).optional() })
        .optional(),
      include_tools: z.array(z.string()).optional(),
      exclude_tools: z.array(z.string()).optional(),
      bundle: z.strictObject({ mcpb: z.boolean().optional(), docker: z.boolean().optional() }).optional(),
    })
    .optional(),
  cli: z.strictObject({ ...targetBase, binary: z.string(), module: z.string() }).optional(),
  terraform: z
    .strictObject({
      ...targetBase,
      provider: z.string().regex(/^[a-z][a-z0-9]*$/, "provider names are lowercase letters and digits"),
      module: z.string(),
    })
    .optional(),
  docs: z
    .strictObject({
      ...targetBase,
      framework: z.enum(["astro-starlight"]).optional(),
      languages: z.array(z.string()).optional(),
      guides_dir: z.string().optional(),
      search: z
        .strictObject({
          prose: z.enum(["pagefind"]).optional(),
          reference: z.enum(["minisearch", "orama"]).optional(),
        })
        .optional(),
      llm: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

const DiagnosticCodeListSchema = z.array(
  z.string().regex(/^K\d{4}$/, 'expected a diagnostic code like "K0201"'),
);

export const KilngenConfigSchema = z.strictObject({
  version: z.literal(1),
  edition: EditionSchema,
  project: z.strictObject({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/, "project names are lowercase letters, digits and dashes"),
    display_name: z.string().optional(),
    license: z.string().optional(),
    homepage: z.url().optional(),
    support_email: z.email().optional(),
  }),
  spec: z
    .strictObject({
      path: z.string().optional(),
      paths: z.array(z.string()).optional(),
      overlays: z.array(z.string()).optional(),
    })
    .refine((s) => !(s.path && s.paths), { message: "use either `path` or `paths`, not both" })
    .optional(),
  environments: z.record(z.string(), z.url()).optional(),
  auth: AuthSchema.optional(),
  client: ClientSchema.optional(),
  errors: z.record(z.string().regex(/^([1-5]\d\d|[1-5]xx)$/), z.string()).optional(),
  pagination: z.array(PaginationSchemeSchema).optional(),
  streaming: z
    .strictObject({
      sse: z
        .strictObject({
          content_type: z.string().optional(),
          done_sentinel: z.string().optional(),
          error_event: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  resources: z.record(z.string(), ResourceSchema).optional(),
  targets: TargetsSchema.optional(),
  codegen: z
    .strictObject({
      output_dir: z.string().optional(),
      git: z
        .strictObject({
          enabled: z.boolean().optional(),
          generated_branch: z.string().optional(),
          integration_branch: z.string().optional(),
          on_conflict: z.enum(["stop", "branch"]).optional(),
        })
        .optional(),
      keep_files: z.array(z.string()).optional(),
      formatters: z.strictObject({ mode: z.enum(["host", "docker"]) }).optional(),
    })
    .optional(),
  diagnostics: z
    .strictObject({
      ignore: DiagnosticCodeListSchema.optional(),
      error: DiagnosticCodeListSchema.optional(),
      warn: DiagnosticCodeListSchema.optional(),
    })
    .optional(),
});

export type KilngenConfig = z.infer<typeof KilngenConfigSchema>;
export type ResourceConfig = z.infer<typeof ResourceSchema>;
export type MethodConfig = z.infer<typeof MethodConfigSchema>;
