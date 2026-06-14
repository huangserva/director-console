// v3-1: 模型/provider 配置中心模态。列 6 个 provider，每个可改 启用/baseUrl/endpoint/代理/apiKeyEnvVar/密钥值，
// 测试连接（三态徽标），保存（PUT，422 展示 failures 不吞）。密钥 write-only：占位按 isKeySet 提「已设置/未设置」，
// 输入后保存才写入，从不回显明文。全中文。
import { useEffect, useState } from "react";
import { checkProviderHealth, getProviders, updateProvider } from "../lib/api";
import {
  buildUpdateBody,
  formFromProvider,
  healthBadge,
  keyPlaceholder,
  validateProviderForm,
  type Provider,
  type ProviderForm,
  type ProviderHealth,
} from "../lib/providers";

type RowState = {
  form: ProviderForm;
  health: ProviderHealth | null;
  checking: boolean;
  saving: boolean;
  failures: string[];
  saved: boolean;
};

function initRow(p: Provider): RowState {
  return { form: formFromProvider(p), health: null, checking: false, saving: false, failures: [], saved: false };
}

export function ProviderConfigModal(props: { onClose: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await getProviders();
      setProviders(list);
      setRows(Object.fromEntries(list.map((p) => [p.id, initRow(p)])));
    } catch (e) {
      setLoadError("无法加载 provider 配置，请检查本地服务（:4099）。");
      void e;
    } finally {
      setLoading(false);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    void reload();
  }, []);

  const patchForm = (id: string, patch: Partial<ProviderForm>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], form: { ...prev[id].form, ...patch }, saved: false, failures: [] } }));
  const patchRow = (id: string, patch: Partial<RowState>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const onCheck = async (id: string) => {
    patchRow(id, { checking: true });
    try {
      const health = await checkProviderHealth(id);
      patchRow(id, { health, checking: false });
    } catch {
      patchRow(id, { health: { providerId: id, ok: false, status: "down", detail: "健康检查请求失败" }, checking: false });
    }
  };

  const onSave = async (p: Provider) => {
    const row = rows[p.id];
    const clientFailures = validateProviderForm(row.form);
    if (clientFailures.length) {
      patchRow(p.id, { failures: clientFailures, saved: false });
      return;
    }
    patchRow(p.id, { saving: true, failures: [], saved: false });
    const res = await updateProvider(p.id, buildUpdateBody(row.form, p));
    if (res.ok && res.provider) {
      // 用 redacted 的回包刷新本行（密钥值清空，占位按新 isKeySet）。
      setProviders((prev) => prev.map((x) => (x.id === p.id ? res.provider! : x)));
      patchRow(p.id, { saving: false, saved: true, failures: [], form: formFromProvider(res.provider) });
    } else {
      patchRow(p.id, { saving: false, saved: false, failures: res.failures?.length ? res.failures : [res.error ?? "保存失败"] });
    }
  };

  return (
    <div className="pc-modal-overlay" onClick={props.onClose}>
      <div className="pc-modal pc-provider-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pc-modal-head">
          <span>配置中心 · 模型与服务</span>
          <button className="pc-modal-close" onClick={props.onClose} title="关闭">
            ×
          </button>
        </div>
        <div className="pc-provider-body">
          <p className="pc-note muted">密钥只写不回显：保存后写入后端 .env.local，界面只显示「已设置 / 未设置」。</p>
          {loading && <div className="pc-note muted">加载中…</div>}
          {loadError && (
            <div className="banner warn">
              {loadError}
              <div className="pc-tpl-status-actions">
                <button className="primary" onClick={() => void reload()}>
                  重试
                </button>
              </div>
            </div>
          )}
          {!loading &&
            providers.map((p) => {
              const row = rows[p.id];
              if (!row) return null;
              const badge = row.health ? healthBadge(row.health.status) : null;
              return (
                <div key={p.id} className="pc-provider-card">
                  <div className="pc-provider-head">
                    <label className="pc-provider-toggle">
                      <input
                        type="checkbox"
                        checked={row.form.enabled}
                        onChange={(e) => patchForm(p.id, { enabled: e.target.checked })}
                      />
                      <span className="pc-provider-label">{p.label}</span>
                      <span className="pc-provider-id muted">{p.id}</span>
                    </label>
                    <span className="pc-provider-status">
                      {badge && <span className={`pc-health-badge ${badge.tone}`}>{badge.label}</span>}
                      {row.health?.latencyMs != null && <span className="muted"> {row.health.latencyMs}ms</span>}
                      {row.health?.detail && <span className="muted pc-health-detail"> {row.health.detail}</span>}
                    </span>
                  </div>
                  <div className="pc-provider-fields">
                    <label className="pc-pf">
                      <span>基础地址 baseUrl</span>
                      <input value={row.form.baseUrl} onChange={(e) => patchForm(p.id, { baseUrl: e.target.value })} placeholder="http://127.0.0.1:端口" />
                    </label>
                    <label className="pc-pf">
                      <span>接口路径 endpoint</span>
                      <input value={row.form.endpoint} onChange={(e) => patchForm(p.id, { endpoint: e.target.value })} placeholder="可选" />
                    </label>
                    <label className="pc-pf">
                      <span>代理 proxy</span>
                      <input value={row.form.proxy} onChange={(e) => patchForm(p.id, { proxy: e.target.value })} placeholder="http(s):// 或 socks5://（可选）" />
                    </label>
                    <label className="pc-pf">
                      <span>密钥环境变量名 apiKeyEnvVar</span>
                      <input value={row.form.apiKeyEnvVar} onChange={(e) => patchForm(p.id, { apiKeyEnvVar: e.target.value })} placeholder="如 OPENAI_API_KEY" />
                    </label>
                    <label className="pc-pf pc-pf-key">
                      <span>密钥值（只写不回显）</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={row.form.apiKeyValue}
                        onChange={(e) => patchForm(p.id, { apiKeyValue: e.target.value })}
                        placeholder={keyPlaceholder(p.isKeySet)}
                      />
                    </label>
                  </div>
                  {row.failures.length > 0 && (
                    <div className="banner warn pc-provider-failures">
                      {row.failures.map((f, i) => (
                        <div key={i}>{f}</div>
                      ))}
                    </div>
                  )}
                  <div className="pc-provider-actions">
                    <button onClick={() => void onCheck(p.id)} disabled={row.checking}>
                      {row.checking ? "检测中…" : "测试连接"}
                    </button>
                    <button className="primary" onClick={() => void onSave(p)} disabled={row.saving}>
                      {row.saving ? "保存中…" : row.saved ? "已保存" : "保存"}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
