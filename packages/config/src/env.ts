import { z } from "zod";

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value: string | boolean) => (typeof value === "boolean" ? value : value === "true"))
    .optional()
    .default(defaultValue);

const rawEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production", "staging"])
    .optional()
    .default("development"),
  NEXT_PUBLIC_GATEWAY_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:8080"),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_SOCKET_IO: booleanFromEnv(false),
  NEXT_PUBLIC_ENABLE_SOCKET: booleanFromEnv(false),
  NEXT_PUBLIC_ETHOS_GATEWAY: z.string().url().optional(),
  ETHOS_GATEWAY: z.string().url().optional(),
  NEXT_PUBLIC_ETHOS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_ETHOS_USER_ID: z.string().optional().default("guest"),
  NEXT_PUBLIC_ETHOS_DISPLAY_NAME: z.string().optional().default("Guest"),
  NEXT_PUBLIC_ECO_API_URL: z.string().url().optional(),
  ECO_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_ECO_INDEXER_URL: z.string().url().optional(),
  ECO_INDEXER_URL: z.string().url().optional(),
  NEXT_PUBLIC_AGENT_GRPC_URL: z
    .string()
    .url()
    .optional()
    .default("http://127.0.0.1:50051"),
  ECO_MANIFEST_ROOT: z.string().optional(),
  SYMBOLCAST_GATEWAY: z.string().url().optional(),
  ETHOS_JWT_SECRET: z.string().optional().default("insecure-dev-secret"),
  ETHOS_HTTP_ADDR: z.string().optional().default("0.0.0.0:8080"),
  ETHOS_GRPC_ADDR: z.string().optional().default("0.0.0.0:8081"),
  ETHOS_NATS_URL: z.string().url().optional(),
  ETHOS_DATABASE_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  ETHOS_MATRIX_HOMESERVER: z.string().url().optional(),
  ETHOS_MATRIX_ACCESS_TOKEN: z.string().optional(),
  ETHOS_MATRIX_REFRESH_TOKEN: z.string().optional(),
  ETHOS_MATRIX_USER_ID: z.string().optional(),
  ETHOS_MATRIX_DEVICE_ID: z.string().optional(),
});

export const envSchema = rawEnvSchema.transform((values: z.infer<typeof rawEnvSchema>) => {
  const gatewayUrl = values.NEXT_PUBLIC_GATEWAY_URL;
  const apiUrl = values.NEXT_PUBLIC_API_URL ?? gatewayUrl;
  const ethosGatewayUrl =
    values.ETHOS_GATEWAY ?? values.NEXT_PUBLIC_ETHOS_GATEWAY ?? gatewayUrl;
  const ecoApiUrl = values.ECO_API_URL ?? values.NEXT_PUBLIC_ECO_API_URL ?? gatewayUrl;
  const ecoIndexerUrl =
    values.ECO_INDEXER_URL ?? values.NEXT_PUBLIC_ECO_INDEXER_URL ?? null;
  const databaseUrl =
    values.ETHOS_DATABASE_URL ??
    values.DATABASE_URL ??
    "postgres://ethos:ethos@localhost:5432/ethos";

  return {
    nodeEnv: values.NODE_ENV,
    web: {
      gatewayUrl,
      apiUrl,
      enableSocketIo: values.NEXT_PUBLIC_ENABLE_SOCKET_IO,
      enableSocket: values.NEXT_PUBLIC_ENABLE_SOCKET,
    },
    etherPod: {
      gatewayUrl: ethosGatewayUrl,
      ecoApiUrl,
      ecoIndexerUrl,
      manifestRoot: values.ECO_MANIFEST_ROOT ?? null,
      symbolcastGatewayUrl:
        values.SYMBOLCAST_GATEWAY ?? `${ethosGatewayUrl.replace(/\/$/, "")}/symbolcast`,
    },
    ethos: {
      token: values.NEXT_PUBLIC_ETHOS_TOKEN ?? null,
      userId: values.NEXT_PUBLIC_ETHOS_USER_ID,
      displayName: values.NEXT_PUBLIC_ETHOS_DISPLAY_NAME,
    },
    agent: {
      grpcUrl: values.NEXT_PUBLIC_AGENT_GRPC_URL,
    },
    gateway: {
      jwtSecret: values.ETHOS_JWT_SECRET,
      httpAddr: values.ETHOS_HTTP_ADDR,
      grpcAddr: values.ETHOS_GRPC_ADDR,
      natsUrl: values.ETHOS_NATS_URL ?? null,
      databaseUrl,
      matrix:
        values.ETHOS_MATRIX_HOMESERVER != null
          ? {
              homeserver: values.ETHOS_MATRIX_HOMESERVER,
              accessToken: values.ETHOS_MATRIX_ACCESS_TOKEN ?? null,
              refreshToken: values.ETHOS_MATRIX_REFRESH_TOKEN ?? null,
              userId: values.ETHOS_MATRIX_USER_ID ?? null,
              deviceId: values.ETHOS_MATRIX_DEVICE_ID ?? null,
            }
          : null,
    },
  } as const;
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (values: Record<string, string | undefined> = process.env) =>
  envSchema.parse(values);

export const env = loadEnv();

export const toJSON = (values: Env = env): Env => values;
