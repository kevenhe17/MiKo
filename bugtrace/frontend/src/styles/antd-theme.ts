/**
 * Ant Design Vue 主题层（v0.2 设计基建）
 *
 * 设计原则：不照搬 Ant Design 默认外观，而是把 BugTrace 既有品牌语言
 * （天蓝主色 / 8-16px 圆角 / 冷调中性色 / 业务蓝阴影）通过 antdv 的
 * Design Token 注入组件，让组件能力升级的同时视觉资产不丢失。
 *
 * 唯一真相源仍是 styles/index.css 里的 --bt-* 变量；本文件负责
 * 把那些值翻译成 antdv 能消费的 token（antdv 的 CSS-in-JS 不读 CSS 变量）。
 */

/** 与 index.css 保持同值的品牌常量（改这里时同步改 index.css） */
export const BRAND = {
  primary: '#3B8CFF',
  primaryDark: '#2b7be6',
  primaryLight: '#7FC4FF',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#0891b2',
  textTitle: '#1e293b',
  textBody: '#334155',
  textMuted: '#64748b',
  border: '#e2e8f0',
  bgPage: '#f5f7fb',
  bgCard: '#ffffff',
  // 字体：UI 用无衬线，展示性标题仍由 index.css 的 --bt-font-display 控制
  fontBody:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
} as const;

/**
 * 全局 token：定义组件的基础物理属性（圆角、字号、控件高度、阴影）
 * 这一层决定"看起来像不像 BugTrace"，而不是"像不像 Ant Design"。
 */
const token = {
  colorPrimary: BRAND.primary,
  colorInfo: BRAND.primary,
  colorSuccess: BRAND.success,
  colorWarning: BRAND.warning,
  colorError: BRAND.error,
  colorLink: BRAND.primary,

  colorTextBase: BRAND.textTitle,
  colorText: BRAND.textBody,
  colorTextSecondary: BRAND.textMuted,
  colorTextTertiary: BRAND.textMuted,
  colorBorder: BRAND.border,
  colorBorderSecondary: '#eef1f6',
  colorBgLayout: BRAND.bgPage,

  fontFamily: BRAND.fontBody,
  fontSize: 14,

  // 4pt 造型体系：8px 基础圆角，与 --bt-radius-sm 对齐（antd 默认 6px 偏紧）
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,

  // 控件高度：36px 是紧凑与舒适的平衡点（antd 默认 32px 偏挤）
  controlHeight: 36,
  controlHeightLG: 44,
  controlHeightSM: 28,

  // 阴影沿用业务蓝调，避免 antd 默认的黑灰阴影破坏统一感
  boxShadow: '0 1px 2px rgba(58,123,224,0.04), 0 8px 24px rgba(58,123,224,0.08)',
  boxShadowSecondary: '0 12px 32px rgba(46,107,214,0.16)',

  wireframe: false,
};

/**
 * 组件级 token：只覆盖"必须贴合现有设计"的属性，
 * 其余交给 antd 的成熟默认值——这是引入 antdv 的价值所在。
 */
const components = {
  Layout: {
    headerHeight: 64,
    headerBg: 'transparent',
    headerPadding: '0 24px',
    bodyBg: BRAND.bgPage,
  },
  Card: {
    borderRadiusLG: 12,
    paddingLG: 20,
    headerFontSize: 16,
  },
  Table: {
    headerBg: '#f8faff',
    headerColor: BRAND.textMuted,
    headerSplitColor: 'transparent',
    rowHoverBg: '#f5f6ff',
    borderColor: BRAND.border,
    // 用户诉求「表格间隔拉大」：纵向 16px / 横向 20px，比 antd 默认更透气
    cellPaddingBlock: 16,
    cellPaddingInline: 20,
  },
  Button: {
    fontWeight: 500,
    primaryShadow: 'none',
    defaultShadow: 'none',
  },
  Input: {
    paddingBlock: 6,
  },
  Select: {
    optionSelectedBg: '#f0f7ff',
  },
  Modal: {
    borderRadiusLG: 16,
    titleFontSize: 17,
  },
  Tag: {
    borderRadiusSM: 6,
  },
  Menu: {
    itemBorderRadius: 999,
    itemSelectedBg: 'rgba(59,140,255,0.10)',
    itemSelectedColor: BRAND.primary,
    itemHoverBg: 'rgba(59,140,255,0.06)',
  },
  Tooltip: {
    borderRadius: 8,
  },
  Timeline: {
    dotBg: BRAND.bgCard,
  },
};

export const antdTheme = { token, components };
