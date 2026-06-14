// v3-1: 模型/provider 配置中心的纯逻辑（状态映射 / 客户端预校验 / PUT body 构建）。
// 密钥是 write-only：GET 永远 redact（只有 isKeySet），表单的 apiKeyValue 仅在用户输入新值时才进 PUT body，从不回显明文。

export interface Provider {
  id: string;
  label: string;
  enabled: boolean;
  baseUrl?: string;
  endpoint?: string;
  apiKeyEnvVar?: string;
  proxy?: string;
  extra?: Record<string, unknown>;
  isKeySet: boolean;
}

export interface ProviderHealth {
  providerId: string;
  ok: boolean;
  status: "up" | "down" | "unconfigured";
  latencyMs?: number;
  detail?: string;
}

export interface ProviderUpdateResult {
  ok: boolean;
  provider?: Provider;
  error?: string;
  failures?: string[];
}

export interface ProviderForm {
  enabled: boolean;
  baseUrl: string;
  endpoint: string;
  apiKeyEnvVar: string;
  apiKeyValue: string; // 仅写入；空串=不改密钥
  proxy: string;
}

/** 用 provider 初始化表单。apiKeyValue 永远从空开始（write-only，不回显）。 */
export function formFromProvider(p: Provider): ProviderForm {
  return {
    enabled: p.enabled,
    baseUrl: p.baseUrl ?? "",
    endpoint: p.endpoint ?? "",
    apiKeyEnvVar: p.apiKeyEnvVar ?? "",
    apiKeyValue: "",
    proxy: p.proxy ?? "",
  };
}

/** 健康三态 → 徽标色调 + 中文文案。 */
export function healthBadge(status: ProviderHealth["status"]): { tone: "ok" | "bad" | "muted"; label: string } {
  switch (status) {
    case "up":
      return { tone: "ok", label: "在线" };
    case "down":
      return { tone: "bad", label: "离线" };
    default:
      return { tone: "muted", label: "未配置" };
  }
}

/** 密钥输入框占位：按 isKeySet 提示「已设置/未设置」，从不显示明文。 */
export function keyPlaceholder(isKeySet: boolean): string {
  return isKeySet ? "已设置（留空保留，输入则覆盖）" : "未设置（输入以写入 .env.local）";
}

const URL_RE = /^https?:\/\//i;
const PROXY_RE = /^(https?|socks5?):\/\//i;

/** 客户端预校验（服务端 422 仍权威）：返回中文 failures。 */
export function validateProviderForm(form: ProviderForm): string[] {
  const failures: string[] = [];
  if (form.baseUrl.trim() && !URL_RE.test(form.baseUrl.trim())) failures.push("基础地址需以 http:// 或 https:// 开头");
  if (form.proxy.trim() && !PROXY_RE.test(form.proxy.trim())) failures.push("代理地址需以 http(s):// 或 socks5:// 开头");
  if (form.apiKeyValue && !form.apiKeyEnvVar.trim()) failures.push("填写密钥值前需先指定 apiKeyEnvVar 名");
  return failures;
}

/** 构建 PUT body：apiKeyValue 仅在用户输入新值时携带（write-only，绝不回显）；extra 原样保留。 */
export function buildUpdateBody(form: ProviderForm, original: Provider): Record<string, unknown> {
  const body: Record<string, unknown> = {
    enabled: form.enabled,
    baseUrl: form.baseUrl.trim(),
    endpoint: form.endpoint.trim(),
    apiKeyEnvVar: form.apiKeyEnvVar.trim(),
    proxy: form.proxy.trim(),
    extra: original.extra,
  };
  if (form.apiKeyValue) body.apiKeyValue = form.apiKeyValue;
  return body;
}
