/**
 * Script catalogue read from the code directory (code/*.js), the same way as dashboard-v2's scripts.ts:
 * top-level `var CONFIG = {…}` and a few other literal variables are read from the AST, never executed.
 * The hash covers the script and the shared modules its bundle embeds, so any change asks for a rebuild.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Expression, PrivateIdentifier, Program, SpreadElement, VariableDeclaration } from 'acorn';
import { parse } from 'acorn';
import { isRecord, truthy } from '../../shared/raw.ts';

export type ScriptType = 'warrior' | 'priest' | 'ranger' | 'mage' | 'rogue' | 'merchant' | 'utility';
export type ScriptKind = 'farm' | 'crypt' | 'utility';

export interface ScriptInfo {
  readonly id: string;
  readonly filename: string;
  readonly label: string;
  readonly ctype: ScriptType;
  readonly kind: ScriptKind;
  readonly bytes: number;
  readonly hash: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly variables: Readonly<Record<string, unknown>>;
}

export function parseScript(source: string): Program {
  return parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class NotLiteral extends Error {}

function arithmetic(operator: string, left: unknown, right: unknown): unknown {
  if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
    return `${String(left)}${String(right)}`;
  }
  if (typeof left !== 'number' || typeof right !== 'number') {
    throw new NotLiteral();
  }
  const results: Readonly<Record<string, number>> = { '*': left * right, '/': left / right, '+': left + right, '-': left - right };
  const result = results[operator];
  if (result === undefined) {
    throw new NotLiteral();
  }
  return result;
}

function keyName(key: Expression | PrivateIdentifier): string | null {
  if (key.type === 'Identifier') {
    return key.name;
  }
  return key.type === 'Literal' ? String(key.value) : null;
}

function objectLiteral(node: Extract<Expression, { type: 'ObjectExpression' }>): Record<string, unknown> {
  return Object.fromEntries(node.properties.map((property) => {
    if (property.type !== 'Property' || property.computed || property.kind !== 'init') {
      throw new NotLiteral();
    }
    const { key } = property;
    const name = keyName(key);
    if (name === null || UNSAFE_KEYS.has(name)) {
      throw new NotLiteral();
    }
    return [name, literal(property.value)];
  }));
}

/** Value of a literal setting (numbers, strings, arrays, plain objects, simple arithmetic); throws otherwise. */
function literal(node: Expression | SpreadElement | null): unknown {
  switch (node?.type) {
    case 'Literal':
      return node.value;
    case 'ArrayExpression':
      return node.elements.map(literal);
    case 'ObjectExpression':
      return objectLiteral(node);
    case 'UnaryExpression':
      if (node.operator === '-') {
        return arithmetic('-', 0, literal(node.argument));
      }
      throw new NotLiteral();
    case 'BinaryExpression':
      if (node.left.type === 'PrivateIdentifier') {
        throw new NotLiteral();
      }
      return arithmetic(node.operator, literal(node.left), literal(node.right));
    default:
      throw new NotLiteral();
  }
}

/** Top-level `var NAME = <literal>` values; anything computed is left out. */
function tryLiteral(node: Expression): { readonly value: unknown } | null {
  try {
    return { value: literal(node) };
  } catch (error) {
    if (error instanceof NotLiteral) {
      return null;
    }
    throw error;
  }
}

function declared(node: VariableDeclaration): [string, unknown][] {
  return node.declarations.flatMap((declaration): [string, unknown][] => {
    const found = declaration.id.type === 'Identifier' && declaration.init !== null && declaration.init !== undefined ? tryLiteral(declaration.init) : null;
    return found === null || declaration.id.type !== 'Identifier' ? [] : [[declaration.id.name, found.value]];
  });
}

export function literalVariables(source: string): Record<string, unknown> {
  return Object.fromEntries(parseScript(source).body.flatMap((node) => (node.type === 'VariableDeclaration' ? declared(node) : [])));
}

function typeOf(filename: string): ScriptType {
  const rules: readonly (readonly [string, ScriptType])[] = [
    ['-rogue', 'rogue'], ['eadroma-', 'warrior'], ['aedroma-', 'priest'], ['droma-', 'ranger'], ['tonerre-', 'mage'], ['merchant', 'merchant'],
  ];
  return rules.find(([part]) => filename.includes(part))?.[1] ?? 'utility';
}

const FARM_MODULES = ['event-expedition.js', 'action-timing.js', 'event-router.js', 'style-loadout.js', 'cave-dreams.js', 'crypt-run.js', 'world-event-intel.js', 'movement-watchdog.js', 'runtime-policy.js', 'combat-gear.js'];
const MERCHANT_MODULES = ['event-expedition.js', 'merchant-halloween.js', 'merchant-witch-cipher.js', 'crypt-supply.js', 'bank-sorter.js', 'movement-watchdog.js', 'runtime-policy.js'];

function sharedModules(ctype: ScriptType, kind: ScriptKind): readonly string[] {
  if (kind === 'farm' && ctype !== 'merchant') {
    return ctype === 'warrior' ? [...FARM_MODULES, 'dragold-intel.js'] : FARM_MODULES;
  }
  return ctype === 'merchant' ? MERCHANT_MODULES : [];
}

function kindOf(filename: string, ctype: ScriptType): ScriptKind {
  if (filename.includes('crypt')) {
    return 'crypt';
  }
  return ctype === 'utility' ? 'utility' : 'farm';
}

function sharedSource(directory: string, ctype: ScriptType, kind: ScriptKind): string {
  const modules = sharedModules(ctype, kind);
  return modules.map((name) => path.join(directory, name)).filter((file) => existsSync(file)).map((file) => readFileSync(file, 'utf8')).join('\n');
}

function readScript(directory: string, filename: string): ScriptInfo {
  const source = readFileSync(path.join(directory, filename), 'utf8');
  const values = literalVariables(source);
  const ctype = typeOf(filename);
  const kind = kindOf(filename, ctype);
  const merchantExtra = ctype === 'merchant' ? readFileSync(path.join(directory, 'compound-production.js'), 'utf8') : '';
  return {
    id: filename.slice(0, -3),
    filename,
    label: filename.replace('.js', '').split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' · '),
    ctype,
    kind,
    bytes: Buffer.byteLength(source),
    hash: createHash('sha256').update(source).update(sharedSource(directory, ctype, kind)).update(merchantExtra).digest('hex'),
    config: isRecord(values['CONFIG']) ? values['CONFIG'] : {},
    variables: Object.fromEntries(['HUNT_ALLOW', 'JOIN_EVENTS', 'WANDERER_SLOT', 'BOSS_CHECKS'].filter((name) => truthy(values[name])).map((name) => [name, values[name]])),
  };
}

/** Deployable scripts: those with a CONFIG that is not marked STANDALONE. Reparsed only when a file changes. */
export function createCatalogue(directory: string): () => readonly ScriptInfo[] {
  let cached: { readonly signature: string; readonly list: readonly ScriptInfo[] } | null = null;
  return () => {
    const files = readdirSync(directory).filter((file) => file.endsWith('.js'));
    const signature = files.map((file) => `${file}:${String(statSync(path.join(directory, file)).mtimeMs)}`).join('|');
    if (cached?.signature !== signature) {
      const list = files.map((file) => readScript(directory, file)).filter((script) => script.config['STANDALONE'] !== true && Object.keys(script.config).length > 0);
      cached = { signature, list };
    }
    return cached.list;
  };
}
