// v3-5 『一句话自动生成』无凭据路径（粘脚本）的纯函数：前置校验 + 4xx 友好提示。
// 后端：POST /generate/from-script {script(≤20000),name?,title?,overwrite?} → 200/400/413/409/422。

export const SCRIPT_MAX = 20000;

export interface GenerateForm {
  script: string;
  name: string;
  title: string;
}

export interface GenerateValidation {
  ok: boolean;
  reason?: string;
}

// 提交前轻量校验（脚本必填、≤2 万字）。服务端仍权威。
export function validateGenerateForm(form: GenerateForm): GenerateValidation {
  if (form.script.trim() === "") return { ok: false, reason: "请先粘贴脚本文本。" };
  if (form.script.length > SCRIPT_MAX) {
    return { ok: false, reason: `脚本过长（${form.script.length} 字），请控制在 ${SCRIPT_MAX} 字以内。` };
  }
  return { ok: true };
}

export interface GenerateResult {
  ok: boolean;
  name?: string;
  manifestName?: string;
  scenes?: number;
  manifestPath?: string;
  planPath?: string;
  status?: number;
  error?: string;
  failures?: string[];
}

// 后端 4xx/状态 → 友好中文（读 body 不吞原始 error/failures）。
export function generateErrorMessage(result: GenerateResult): string {
  switch (result.status) {
    case 400:
      return "脚本为空或项目名非法，请检查后重试。";
    case 413:
      return `脚本过长（超过 ${SCRIPT_MAX} 字），请精简后再试。`;
    case 409:
      return "项目名已存在，换个名字再生成。";
    case 422: {
      const n = result.failures?.length ?? 0;
      return n > 0 ? `生成校验失败（${n} 项），详见下方。` : "生成校验失败。";
    }
    default:
      return result.error ?? "生成失败，请稍后重试或检查本地服务。";
  }
}
