/**
 * Plan 036 O2: the rules by which `design-tokens.json` (the community format that `design-system-tokens` writes:
 * `$value`, `$type`, aliases in braces) becomes the list form that the Design System type of Claude Design reads
 * (its own instructions: every family but `type` is `{"tokens": [{name, value, usage}]}`, and a nested `$value`
 * map is "valid JSON the page CANNOT read"). The skill's reference table states the same rules in prose; this is the
 * code that holds the table's worked examples to them. It is test support: no role runs it, because the skill has no
 * script by decision D24 of Plan 035 (its only loader has no shell).
 */

export interface TokenEntry {
  name: string;
  value: string;
  usage: string;
}

export interface TypeStyle {
  name: string;
  fontSize: string;
  fontWeight?: number | string;
  lineHeight?: number | string;
}

export interface ListTokens {
  name: string;
  version: 1;
  color: { themes: Array<{ id: string; name: string }>; tokens: TokenEntry[] };
  type?: { fonts: unknown[]; families: Record<string, string>; groups: Array<{ name: string; family?: string; styles: TypeStyle[] }> };
  spacing?: { tokens: TokenEntry[] };
  radius?: { tokens: TokenEntry[] };
  [family: string]: unknown;
}

interface Leaf {
  path: string[];
  value: string;
  description: string;
}

const ALIAS = /^\{([^{}]+)\}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOUR_FUNCTION = /^(?:rgb|rgba|hsl|hsla|oklch)\([^()]*\)$/i;
const LENGTH = /^-?\d+(?:\.\d+)?(?:px|rem|em|%)?$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function leaves(node: unknown, trail: string[] = []): Leaf[] {
  if (!isObject(node)) return [];
  if ('$value' in node) {
    const value = node['$value'];
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`${trail.join('.')}: a token value must be a string or a number`);
    const description = node['$description'];
    return [{ path: trail, value: String(value), description: typeof description === 'string' ? description.trim() : '' }];
  }
  return Object.entries(node)
    .filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, child]) => leaves(child, [...trail, key]));
}

/** The name a colour token has in the list form: the word `color` is dropped and the rest joined with a dash. */
function colourName(path: string[]): string {
  return path.slice(1).join('-');
}

function checkLength(value: string, where: string): string {
  if (!LENGTH.test(value)) throw new Error(`${where}: "${value}" is not a number or a length in px, rem, em or %`);
  return value;
}

function checkColour(value: string, where: string): string {
  if (ALIAS.test(value) || HEX.test(value) || COLOUR_FUNCTION.test(value)) return value;
  throw new Error(`${where}: "${value}" is not hex, rgb(), rgba(), hsl(), oklch() or an alias: the page drops it`);
}

function asNumber(value: string): number | string {
  return /^\d+$/.test(value) ? Number(value) : value;
}

export function toDesignSystemTokens(source: unknown, name: string): ListTokens {
  const all = leaves(source);
  const byPath = new Map(all.map(l => [l.path.join('.'), l]));
  const resolve = (value: string, seen: string[] = []): string => {
    const m = ALIAS.exec(value);
    if (!m) return value;
    const key = m[1]!;
    if (seen.includes(key)) throw new Error(`alias loop: ${[...seen, key].join(' -> ')}`);
    const target = byPath.get(key);
    if (!target) throw new Error(`alias {${key}} has no token`);
    return resolve(target.value, [...seen, key]);
  };

  const colour: TokenEntry[] = [];
  const spacing: TokenEntry[] = [];
  const radius: TokenEntry[] = [];
  const others: Record<string, TokenEntry[]> = {};
  const families: Record<string, string> = {};
  const sizes = new Map<string, string>();
  const weights = new Map<string, number | string>();
  const lineHeights = new Map<string, number | string>();

  for (const leaf of all) {
    const [family, ...rest] = leaf.path;
    const where = leaf.path.join('.');
    const alias = ALIAS.exec(leaf.value);
    switch (family) {
      case 'color': {
        let value = leaf.value;
        if (alias) {
          const target = byPath.get(alias[1]!);
          if (!target) throw new Error(`${where}: alias {${alias[1]}} has no token`);
          if (target.path[0] !== 'color') throw new Error(`${where}: an alias in the colour family must name a colour token`);
          resolve(leaf.value);
          value = `{${colourName(target.path)}}`;
        }
        colour.push({ name: colourName(leaf.path), value: checkColour(value, where), usage: leaf.description });
        break;
      }
      case 'space':
      case 'spacing':
        spacing.push({ name: ['space', ...rest].join('-'), value: checkLength(resolve(leaf.value), where), usage: leaf.description });
        break;
      case 'radius':
        radius.push({ name: ['radius', ...rest].join('-'), value: checkLength(resolve(leaf.value), where), usage: leaf.description });
        break;
      case 'font': {
        const [kind, ...n] = rest;
        const key = n.join('-');
        const value = resolve(leaf.value);
        if (kind === 'family') families[key] = value;
        else if (kind === 'size') sizes.set(key, checkLength(value, where));
        else if (kind === 'weight') weights.set(key, asNumber(value));
        else if (kind === 'line-height' || kind === 'lineHeight') lineHeights.set(key, /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : checkLength(value, where));
        else throw new Error(`${where}: unknown font token kind "${kind}"`);
        break;
      }
      default:
        (others[family!] ??= []).push({ name: [family!, ...rest].join('-'), value: resolve(leaf.value), usage: leaf.description });
    }
  }

  for (const [kind, map] of [['weight', weights], ['line-height', lineHeights]] as const) {
    for (const key of map.keys()) if (!sizes.has(key)) throw new Error(`font.${kind}.${key} has no font.size.${key}`);
  }

  const out: ListTokens = { name, version: 1, color: { themes: [{ id: 'light', name: 'Light' }], tokens: colour } };
  if (Object.keys(families).length > 0 || sizes.size > 0) {
    const styles: TypeStyle[] = [...sizes].map(([key, fontSize]) => {
      const style: TypeStyle = { name: key, fontSize };
      if (weights.has(key)) style.fontWeight = weights.get(key)!;
      if (lineHeights.has(key)) style.lineHeight = lineHeights.get(key)!;
      return style;
    });
    const first = Object.keys(families)[0];
    out.type = { fonts: [], families, groups: styles.length > 0 ? [{ name: 'Text', ...(first ? { family: first } : {}), styles }] : [] };
  }
  if (spacing.length > 0) out.spacing = { tokens: spacing };
  if (radius.length > 0) out.radius = { tokens: radius };
  for (const [family, tokens] of Object.entries(others)) out[family] = { tokens };

  const names = [...colour, ...spacing, ...radius, ...Object.values(others).flat()].map(t => t.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate) throw new Error(`the name "${duplicate}" is used twice across the families: the page drops a duplicate`);
  const bad = names.find(n => !NAME.test(n));
  if (bad) throw new Error(`the name "${bad}" does not fit [A-Za-z0-9][A-Za-z0-9_.-]{0,63}`);
  return out;
}

/** The rules of the type as errors: an empty list means the page can read every token. */
export function validateDesignSystemTokens(list: ListTokens): string[] {
  const errors: string[] = [];
  const text = JSON.stringify(list);
  if (/"\$value"|"\$type"/.test(text)) errors.push('a nested $value object is left in the list form');
  const colourNames = new Set(list.color.tokens.map(t => t.name));
  const seen = new Set<string>();
  const families: Array<[string, TokenEntry[]]> = [['color', list.color.tokens], ['spacing', list.spacing?.tokens ?? []], ['radius', list.radius?.tokens ?? []]];
  for (const [key, value] of Object.entries(list)) if (!['name', 'version', 'color', 'type', 'spacing', 'radius'].includes(key) && isObject(value) && Array.isArray(value['tokens'])) families.push([key, value['tokens'] as TokenEntry[]]);
  for (const [family, tokens] of families) {
    for (const t of tokens) {
      if (!NAME.test(t.name)) errors.push(`${family}: the name "${t.name}" is not valid`);
      if (seen.has(t.name)) errors.push(`${family}: the name "${t.name}" is used twice`);
      seen.add(t.name);
      if (family === 'color') {
        const m = ALIAS.exec(t.value);
        if (m) {
          if (!colourNames.has(m[1]!)) errors.push(`color: ${t.name} is an alias of "${m[1]}", which is not a colour token`);
          if (m[1] === t.name) errors.push(`color: ${t.name} is an alias of itself`);
        } else if (!HEX.test(t.value) && !COLOUR_FUNCTION.test(t.value)) errors.push(`color: ${t.name} has the value "${t.value}", which the page drops`);
      }
      if ((family === 'spacing' || family === 'radius') && !LENGTH.test(t.value)) errors.push(`${family}: ${t.name} has the length "${t.value}", which the page drops`);
    }
  }
  return errors;
}
