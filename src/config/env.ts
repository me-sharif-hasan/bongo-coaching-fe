import { toGraphqlApiUrl } from "@/lib/graphql/endpoint";

// Reuse one parser for numeric env values so invalid input falls back safely.
const parseTimeout = (value: string | undefined, fallback: number) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

const runtimeGraphqlUrl =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ??
  "https://coaching.bongobrain.it.com/graphiql";

// Server-side POST routes only accept requests from one of these origins.
// Comma-separated so multiple live frontend domains can be allowed during a
// domain migration without breaking the one still in DNS/cache.
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "https://edu.bongobrain.it.com",
  "https://bongo-coaching.iishanto.com",
];

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  process.env.APP_ORIGIN ??
  process.env.NEXT_PUBLIC_APP_ORIGIN
)
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean) ?? defaultAllowedOrigins;

export const env = {
  allowedOrigins,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://coaching.bongobrain.it.com",
  apiTimeout: parseTimeout(process.env.NEXT_PUBLIC_API_TIMEOUT, 10000),
  // `NEXT_PUBLIC_GRAPHQL_URL` may point to the GraphiQL UI, but server requests
  // and codegen need the actual GraphQL endpoint.
  graphqlApiUrl:
    process.env.GRAPHQL_API_URL ?? toGraphqlApiUrl(runtimeGraphqlUrl),
  // The browser always talks to the local Next.js proxy, not the external API directly.
  graphqlProxyPath: "/api/graphql",
  // Refresh tokens live longer than access tokens, so keep this configurable.
  authRefreshCookieMaxAgeSeconds: parseTimeout(
    process.env.AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS,
    60 * 60 * 24 * 30,
  ),
} as const;

export default env;
