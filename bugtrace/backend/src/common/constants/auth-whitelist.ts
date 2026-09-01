// T0-5 · 鉴权白名单：命中以下路径的请求不需要 JWT
// 规则：以 * 结尾的条目按前缀匹配，其余精确匹配（含 /xxx/ 子路径）
// 维护方式：只在此常量表增删，禁止在 Guard 里散落硬编码路径
export const AUTH_WHITELIST: readonly string[] = [
  '/health',
  '/docs*', // Swagger 页面、静态资源与 /docs-json
  '/auth/login',
  // T3-3 · 附件静态直出：<img> 标签无法携带 Authorization 头，图片预览必须免鉴权
  '/uploads*',
];
