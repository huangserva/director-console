// Serious-1: 编辑层（卡片插/选/改、Inspector 改字、画布拖拽、时间线编辑）的统一放行判定。
// 放行条件：没有任何阻塞操作（busy=null），或正在 recaption（长 ASR 不冻结编辑，见 B14）。
// 其它 busy（save/compose/render/template/load/…）一律禁止 mutate manifest —— 否则服务端
// 改写/渲染过程中 UI 还能改，导致 render 用旧版而 UI 显示新、或 save 中又把 dirty 置回的竞态。
export function isEditAllowed(busy: string | null): boolean {
  return busy === null || busy === "recaption";
}
