/**
 * 成绩与目标分数计算器——纯逻辑层。
 *
 * 本目录下的文件禁止出现 document / window / navigator / localStorage
 * （DESIGN.md 红线 1）。所有可能因用户输入而失败的函数返回 Result<T>，
 * 不抛异常（DESIGN.md §9.2）。
 *
 * 对应验收标准：specs/features/grade-calculator.md
 */
import type { Result } from '@/lib/shared/result';
import { err, ok } from '@/lib/shared/result';

/** 计算所需的三个输入都已通过 parse 校验后的形态。 */
export interface GradeState {
  /** 已修部分的平均分（0–100） */
  currentGrade: number;
  /** 期末考占总评的权重（1–100） */
  finalWeight: number;
  /** 目标总评（0–100） */
  targetGrade: number;
}

/** decodeState 返回的原始字符串形态，必须走与手输相同的 parse 路径（BR-004）。 */
export interface GradeStateInput {
  currentGrade: string;
  finalWeight: string;
  targetGrade: string;
}

/**
 * 期末之外的成绩构成的总评分（0–100）。
 *
 * 权重为 1–100：current 已覆盖 (100 − w) 的权重，期末覆盖剩下的 w。
 */
function parseScore(input: string, field: 'Current grade' | 'Target grade'): Result<number> {
  const trimmed = input.trim();
  if (trimmed === '') return err(`Enter your ${field.toLowerCase()}.`);

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return err(`${field} must be a number.`);
  if (value < 0 || value > 100) return err(`${field} must be between 0 and 100.`);

  return ok(value);
}

/** 解析当前成绩（已修部分的平均分，0–100）。 */
export function parseCurrentGrade(input: string): Result<number> {
  return parseScore(input, 'Current grade');
}

/** 解析目标总评（0–100）。 */
export function parseTargetGrade(input: string): Result<number> {
  return parseScore(input, 'Target grade');
}

/**
 * 解析期末权重（1–100）。
 *
 * 0 会让除法失去意义（期末不占分则无法靠期末拉总评），所以下界是 1 而非 0。
 */
export function parseFinalWeight(input: string): Result<number> {
  const trimmed = input.trim();
  if (trimmed === '') return err('Enter the final exam weight.');

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return err('Final exam weight must be a number.');
  if (value < 1 || value > 100) {
    return err('Final exam weight must be between 1 and 100.');
  }

  return ok(value);
}

/**
 * 反向计算所需期末分之后的判定结果。
 *
 * - reachable：0 ≤ required ≤ 100，目标可达
 * - unreachable：required > 100，目标数学上不可达，bestPossible 是即使期末
 *   考满分能拿到的总评
 * - secured：required ≤ 0，期末考 0 分也稳住目标
 */
export type FinalRequirement =
  | { status: 'reachable'; required: number }
  | { status: 'unreachable'; bestPossible: number }
  | { status: 'secured' };

/**
 * 计算「期末要考多少分才能达到目标总评」。
 *
 * required =（target − current ×（100 − w）/100）÷（w / 100）。
 * 内部不做舍入，展示时由 shared/format 的 roundTo 处理（AC-013）。
 *
 * @param current 已修部分平均分（0–100，须先过 parseCurrentGrade）
 * @param finalWeight 期末权重（1–100，须先过 parseFinalWeight）
 * @param target 目标总评（0–100，须先过 parseTargetGrade）
 */
export function computeRequiredFinal(
  current: number,
  finalWeight: number,
  target: number,
): FinalRequirement {
  const doneWeight = (100 - finalWeight) / 100;
  const earned = current * doneWeight;
  const required = (target - earned) / (finalWeight / 100);

  if (required > 100) {
    // bestPossible = 已挣到的部分 + 期末满分挣到的部分
    return { status: 'unreachable', bestPossible: earned + 100 * (finalWeight / 100) };
  }
  if (required <= 0) return { status: 'secured' };
  return { status: 'reachable', required };
}

/** URL 参数名，camelCase 且全小写开头（DESIGN.md §3.3）。 */
const STATE_KEYS = ['currentGrade', 'finalWeight', 'targetGrade'] as const;

/** 把状态编码成查询串（不含开头的 `?`）。 */
export function encodeState(state: GradeState): string {
  const params = new URLSearchParams();
  params.set(STATE_KEYS[0], String(state.currentGrade));
  params.set(STATE_KEYS[1], String(state.finalWeight));
  params.set(STATE_KEYS[2], String(state.targetGrade));
  return params.toString();
}

/**
 * 从查询串还原原始输入字符串。
 *
 * 刻意不做任何校验：返回的原始字符串必须交给与手输相同的 parse 函数
 * （BR-004，URL 里的值不可信），缺失的参数返回空串。
 */
export function decodeState(search: string): GradeStateInput {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  return {
    currentGrade: params.get(STATE_KEYS[0]) ?? '',
    finalWeight: params.get(STATE_KEYS[1]) ?? '',
    targetGrade: params.get(STATE_KEYS[2]) ?? '',
  };
}
