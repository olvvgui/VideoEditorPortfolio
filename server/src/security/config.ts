import { isIP } from "node:net";

export function securityConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(mode))
    throw new Error("NODE_ENV inválido.");
  const production = mode === "production";
  if (
    !env.JWT_SECRET ||
    env.JWT_SECRET.trim().length < 32 ||
    env.JWT_SECRET.startsWith("replace-")
  )
    throw new Error(
      "Configure JWT_SECRET com pelo menos 32 caracteres aleatórios.",
    );
  const configuredOrigin =
    env.FRONTEND_ORIGIN || (production ? "" : "http://localhost:5173");
  let url: URL;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new Error("FRONTEND_ORIGIN deve ser uma origem válida.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== configuredOrigin ||
    url.username ||
    url.password ||
    (production && url.protocol !== "https:")
  )
    throw new Error(
      "FRONTEND_ORIGIN deve conter apenas protocolo e host/porta; produção exige HTTPS.",
    );
  // Only explicit proxy addresses/subnets, never a blanket trust-proxy=true.
  const proxies = (env.TRUST_PROXY || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  for (const proxy of proxies) {
    const [ip, mask, extra] = proxy.split("/");
    const family = isIP(ip);
    if (
      !family ||
      extra !== undefined ||
      (mask !== undefined &&
        (!/^\d+$/.test(mask) || Number(mask) > (family === 4 ? 32 : 128)))
    )
      throw new Error(
        "TRUST_PROXY aceita somente IPs ou CIDRs explícitos separados por vírgula.",
      );
  }
  return { production, origin: url.origin, proxies };
}
