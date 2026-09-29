/**
 * 图片压缩 / 格式转换——纯逻辑层。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。文件解码、canvas 缩放与 toBlob 编码全部由页面层
 * 完成，本模块只做「能收哪些文件、每张按什么参数处理、显示成什么文字」
 * 的决策。
 *
 * 对应验收标准：specs/features/image-compress.md
 */

// ---------------------------------------------------------------------------
// 类型与常量
// ---------------------------------------------------------------------------

/** 页面层传给 validateFiles 的文件描述：只带纯数据，不带浏览器对象。 */
export interface FileDesc {
  name: string;
  type: string;
  size: number;
}

/** 输出格式（mime 的短写）。HEIC 不在其中：它只作输入，输出一律三选一。 */
export type OutputFormat = 'jpeg' | 'png' | 'webp';

/** 一张图生效的处理参数。quality 为 1–100 整数；maxEdge 为 null = 不限制。 */
export interface ImageSettings {
  format: OutputFormat;
  quality: number;
  maxEdge: number | null;
}

/** 每批最多处理的图片数量（BR-002）。 */
export const MAX_FILES = 20;

/** 单文件体积上限：30 MB（BR-003）。 */
export const MAX_FILE_SIZE = 30 * 1024 * 1024;

/** 全局设置的出厂默认：JPG 质量 80，不限尺寸。 */
export const GLOBAL_DEFAULTS: ImageSettings = { format: 'jpeg', quality: 80, maxEdge: null };

/** 视为图片的扩展名（mime 为空时按它兜底，macOS 常给 HEIC 空 mime）。 */
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
  'bmp',
  'avif',
  'tif',
  'tiff',
]);

/** OutputFormat → mime。 */
const MIME: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// ---------------------------------------------------------------------------
// 导入校验（AC-009/010/011/012/013）
// ---------------------------------------------------------------------------

export type RejectReason = 'not-image' | 'too-large';

export interface RejectedFile {
  item: FileDesc;
  reason: RejectReason;
}

export interface ValidateResult {
  accepted: FileDesc[];
  rejected: RejectedFile[];
  /** true = 一次选择的数量超过上限，只收了前 MAX_FILES 张（AC-012）。 */
  truncated: boolean;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function isImageDesc(item: FileDesc): boolean {
  return item.type.startsWith('image/') || IMAGE_EXTENSIONS.has(extensionOf(item.name));
}

/**
 * 逐张判定「收 / 不收」。损坏但声称是图片的文件放行到页面层——只有
 * 真正解码时才知道坏没坏（AC-011 由页面层捕获）。
 */
export function validateFiles(items: FileDesc[]): ValidateResult {
  const accepted: FileDesc[] = [];
  const rejected: RejectedFile[] = [];

  for (const item of items) {
    if (accepted.length >= MAX_FILES) {
      // 超出部分不再逐张判定，统一算截断（AC-012）。
      continue;
    }
    if (!isImageDesc(item)) {
      rejected.push({ item, reason: 'not-image' });
      continue;
    }
    if (item.size > MAX_FILE_SIZE) {
      rejected.push({ item, reason: 'too-large' });
      continue;
    }
    accepted.push(item);
  }

  return { accepted, rejected, truncated: items.length > accepted.length + rejected.length };
}

// ---------------------------------------------------------------------------
// 设置解析（AC-003 / AC-015）
// ---------------------------------------------------------------------------

/** 全局设置 + 单张覆盖 → 该张真正生效的设置（AC-003）。 */
export function effectiveSettings(
  global: ImageSettings,
  override: Partial<ImageSettings> | null,
): ImageSettings {
  return { ...global, ...(override ?? {}) };
}

/** PNG 是无损格式，没有质量参数（AC-015）。 */
export function isQualityApplicable(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/webp';
}

// ---------------------------------------------------------------------------
// 尺寸计算（AC-002）
// ---------------------------------------------------------------------------

export interface TargetSize {
  w: number;
  h: number;
}

/**
 * 最长边限制 → 目标尺寸。**只缩不放**（图本身小于限制时原样返回），
 * 短边按比例四舍五入、下限 1px。
 */
export function targetSize(w: number, h: number, maxEdge: number | null): TargetSize {
  if (maxEdge === null) return { w, h };
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const scale = maxEdge / longest;
  const longSide = maxEdge;
  const shortSide = Math.max(1, Math.round(Math.min(w, h) * scale));
  return w >= h ? { w: longSide, h: shortSide } : { w: shortSide, h: longSide };
}

// ---------------------------------------------------------------------------
// 输出文件名（AC-004）
// ---------------------------------------------------------------------------

/** 输出格式 → 下载文件用的扩展名（jpeg 一律落成 .jpg）。 */
function extensionFor(format: OutputFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

/** `photo.JPG` + png 输出 → `photo-compressed.png`（AC-004）。 */
export function resolveOutputFilename(name: string, mime: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  const format = (Object.keys(MIME) as OutputFormat[]).find((k) => MIME[k] === mime) ?? 'jpeg';
  return `${base}-compressed.${extensionFor(format)}`;
}

// ---------------------------------------------------------------------------
// 体积格式化（AC-007）
// ---------------------------------------------------------------------------

const KB = 1000;
const MB = KB * 1000;
const GB = MB * 1000;

/**
 * 字节数 → `50.6 MB` / `524.3 KB` / `300 B`（十进制单位，一位小数）。
 * 用十进制是为了和 macOS Finder / Windows 资源管理器显示的数字一致，
 * 用户拿压缩结果跟原文件对比时看的是同一个口径。
 */
export function formatBytes(n: number): string {
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  if (n < GB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(1)} GB`;
}

/** 前后总体积 → `50.6 MB → 12.1 MB (-76%)`；变大时 + 号，0% 无符号（AC-007）。 */
export function formatSummary(before: number, after: number): string {
  const percent = before <= 0 ? 0 : Math.round((Math.abs(after - before) / before) * 100);
  const sign = percent === 0 ? '' : after > before ? '+' : '-';
  return `${formatBytes(before)} → ${formatBytes(after)} (${sign}${percent}%)`;
}

// ---------------------------------------------------------------------------
// 输出格式兜底（技术方案 §4：浏览器编码能力探测）
// ---------------------------------------------------------------------------

/**
 * 请求的输出格式浏览器编不了时一律回退 JPEG——它是所有浏览器的公共
 * 分母，永远可用（技术方案 §4）。
 */
export function resolveOutputMime(
  requested: OutputFormat,
  supported: OutputFormat[],
): OutputFormat {
  return supported.includes(requested) ? requested : 'jpeg';
}
