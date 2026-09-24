/**
 * 二维码生成器——载荷构建层（纯逻辑）。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。每个 builder 只做一件事：把表单里的字段拼成
 * 「扫码器认识的那串标准文本」。拼不出来（必填为空）时返回 null，
 * 由页面层决定显示什么提示——这里不抛异常（DESIGN.md §9.2）。
 *
 * 七种载荷的标准写法见 BR-007：Wi-Fi 用 `WIFI:...;;`、名片用 vCard 3.0、
 * 邮件用 `mailto:`、电话用 `tel:`、短信用 `sms:...?body=`。
 *
 * 对应验收标准：specs/features/qr-code.md
 */

/** 七种内容类型，与页面上的标签一一对应。 */
export type QrType = 'link' | 'text' | 'wifi' | 'contact' | 'email' | 'phone' | 'sms';

export interface WifiInput {
  ssid: string;
  password: string;
  /** 加密方式；`none` 生成开放网络凭据（不带密码字段） */
  encryption: 'wpa' | 'wep' | 'none';
}

export interface ContactInput {
  name: string;
  phone: string;
  email: string;
  org: string;
  url: string;
}

export interface EmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SmsInput {
  number: string;
  body: string;
}

/** 已带协议头的写法（`https:` / `mailto:` / …）——不补 https://。 */
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** 空串或纯空白串。所有 builder 用它判定「必填没填」。 */
function isBlank(value: string): boolean {
  return value.trim() === '';
}

/**
 * Wi-Fi 字段转义：`\` `;` `,` `:` `"` 前加反斜杠。
 *
 * 不转义的话，密码里的 `;` 会被扫码器当成字段分隔符，网络就废了（AC-021）。
 * 反斜杠必须最先处理，否则会二次转义。
 */
function escapeWifi(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([;,:"])/g, '\\$1');
}

/** vCard 转义：`\` `;` `,` 与换行（AC-022）。 */
function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([;,])/g, '\\$1')
    .replace(/\r?\n/g, '\\n');
}

/** 电话号码：去掉空格，保留 `+` 与 `-`（AC-023）。 */
function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '');
}

/** 链接：没有协议头时补 `https://`，已有则原样（AC-004）。 */
export function buildLinkPayload(raw: string): string | null {
  const value = raw.trim();
  if (isBlank(value)) return null;
  return SCHEME_PATTERN.test(value) ? value : `https://${value}`;
}

/** 文本：原样编码，只判定空（AC-005 / AC-020）。 */
export function buildTextPayload(raw: string): string | null {
  const value = raw.trim();
  return isBlank(value) ? null : value;
}

/** Wi-Fi：`WIFI:T:<加密>;S:<网络名>;P:<密码>;;`（AC-006 / AC-021）。 */
export function buildWifiPayload(input: WifiInput): string | null {
  const ssid = input.ssid.trim();
  if (isBlank(ssid)) return null;
  const auth = input.encryption === 'wpa' ? 'WPA' : input.encryption === 'wep' ? 'WEP' : 'nopass';
  const head = `WIFI:T:${auth};S:${escapeWifi(ssid)}`;
  // 开放网络不带密码字段——带上会让部分扫码器报错。
  return input.encryption === 'none' ? `${head};;` : `${head};P:${escapeWifi(input.password)};;`;
}

/** 名片：vCard 3.0，只输出填过的字段（AC-008 / AC-022）。 */
export function buildVCardPayload(input: ContactInput): string | null {
  const name = input.name.trim();
  if (isBlank(name)) return null;

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVCard(name)}`];
  if (!isBlank(input.org)) lines.push(`ORG:${escapeVCard(input.org.trim())}`);
  if (!isBlank(input.phone)) lines.push(`TEL:${normalizePhone(input.phone.trim())}`);
  if (!isBlank(input.email)) lines.push(`EMAIL:${escapeVCard(input.email.trim())}`);
  if (!isBlank(input.url)) lines.push(`URL:${escapeVCard(input.url.trim())}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/** 邮件：`mailto:` + 可选的主题与正文（AC-024）。 */
export function buildEmailPayload(input: EmailInput): string | null {
  const to = input.to.trim();
  if (isBlank(to)) return null;

  const params: string[] = [];
  if (!isBlank(input.subject)) params.push(`subject=${encodeURIComponent(input.subject.trim())}`);
  if (!isBlank(input.body)) params.push(`body=${encodeURIComponent(input.body)}`);
  return params.length === 0 ? `mailto:${to}` : `mailto:${to}?${params.join('&')}`;
}

/** 电话：`tel:` + 去空格的号码（AC-023）。 */
export function buildPhonePayload(raw: string): string | null {
  const value = raw.trim();
  return isBlank(value) ? null : `tel:${normalizePhone(value)}`;
}

/** 短信：`sms:` + 号码 + 可选预填内容（AC-011）。 */
export function buildSmsPayload(input: SmsInput): string | null {
  const number = input.number.trim();
  if (isBlank(number)) return null;
  const body = input.body.trim();
  const query = isBlank(body) ? '' : `?body=${encodeURIComponent(input.body.trim())}`;
  return `sms:${normalizePhone(number)}${query}`;
}
