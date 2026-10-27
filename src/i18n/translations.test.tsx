import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { renderHook } from '@testing-library/react';
import { LocaleProvider, useTranslation } from './index';
import { spanish } from './es';
import { english } from './en';

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(file);
    return file.endsWith('.tsx') && !file.endsWith('.test.tsx') ? [file] : [];
  });
}

function visibleLiteral(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return /[\p{L}\p{N}]/u.test(node.text) ? node.text : null;
  }
  if (ts.isJsxText(node)) return /[\p{L}\p{N}]/u.test(node.text) ? node.text.trim() : null;
  return null;
}

function untranslatedText(file: string, content = readFileSync(file, 'utf8')): string[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: string[] = [];
  const initializers = new Map<string, ts.Expression>();
  function collect(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      initializers.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);
  function inspectExpression(node: ts.Expression, seen = new Set<string>()) {
    const value = visibleLiteral(node);
    if (value) violations.push(value);
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      const initializer = initializers.get(node.text);
      if (initializer) inspectExpression(initializer, new Set([...seen, node.text]));
    } else if (ts.isConditionalExpression(node)) {
      inspectExpression(node.whenTrue);
      inspectExpression(node.whenFalse);
    } else if (ts.isBinaryExpression(node)) {
      inspectExpression(node.right);
    }
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const key = node.arguments[0];
      if (key && ts.isStringLiteral(key) && !(key.text in spanish)) {
        violations.push(`Missing Spanish key: ${key.text}`);
      }
    }
    if (ts.isJsxText(node)) {
      const value = visibleLiteral(node);
      if (value) violations.push(value);
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)
      && ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.text)) {
      const value = node.initializer && visibleLiteral(node.initializer);
      if (value) violations.push(value);
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        inspectExpression(node.initializer.expression);
      }
    }
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) {
      inspectExpression(node.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return violations;
}

const catalogKeys = Object.keys(spanish) as (keyof typeof spanish)[];

function placeholders(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\{\{(\w+)\}\}/g), (match) => match[1] ?? ''))].sort();
}

/** Keys whose English text must differ from the Spanish one; a sample across every screen. */
const TRANSLATED_SAMPLE: readonly (keyof typeof spanish)[] = [
  'nav.home', 'nav.analyze', 'nav.alignment', 'nav.generate', 'nav.library', 'nav.profile', 'shell.signIn', 'settings.signOut',
  'workbench.homeLead', 'app.title', 'generator.title', 'alignment.title', 'alignment.regionJoin', 'library.title', 'library.insulin',
  'profile.title', 'descriptors.mass', 'projects.save', 'report.export', 'auth.signUpTitle', 'account.title', 'privacy.title',
  'terms.title', 'legal.updated', 'notFound.title', 'errors.invalidFasta', 'chemistry.cysteine', 'regions.chainA',
];

/** Language names are written in their own language in both catalogs. */
const LANGUAGE_NAME_KEYS: readonly (keyof typeof spanish)[] = ['settings.spanish', 'settings.english'];

describe('typed translations', () => {
  it('keeps both catalogs complete, with the same keys in the same order', () => {
    expect(catalogKeys.length).toBeGreaterThan(0);
    expect(Object.keys(english)).toEqual(Object.keys(spanish));
    for (const key of catalogKeys) {
      expect(spanish[key].trim(), key).not.toBe('');
      expect(english[key].trim(), key).not.toBe('');
    }
  });

  it('leaves no pending marker or Spanish-only character in English', () => {
    for (const key of catalogKeys) {
      expect(english[key], key).not.toContain('[EN pending]');
      if (!LANGUAGE_NAME_KEYS.includes(key)) expect(english[key], key).not.toMatch(/[áéíóúüñ¿¡«»]/i);
    }
    for (const key of LANGUAGE_NAME_KEYS) expect(english[key], key).toBe(spanish[key]);
  });

  it('keeps the same placeholders in both languages', () => {
    for (const key of catalogKeys) expect(placeholders(english[key]), key).toEqual(placeholders(spanish[key]));
  });

  it('translates English instead of copying Spanish', () => {
    for (const key of TRANSLATED_SAMPLE) expect(english[key], key).not.toBe(spanish[key]);
    // Proper names, units and cognates may coincide; texts of three or more words may not.
    const words = (text: string): number => (text.replace(/\{\{\w+\}\}/g, '').match(/\p{L}{2,}/gu) ?? []).length;
    expect(catalogKeys.filter((key) => english[key] === spanish[key] && words(spanish[key]) >= 3)).toEqual([]);
  });

  it('keeps visible component literals behind translation calls', () => {
    const root = resolve('src');
    const violations = componentFiles(root).flatMap((file) =>
      untranslatedText(file).map((value) => `${relative(root, file)}: ${value}`));
    expect(violations).toEqual([]);
  });

  it('detects visible literals hidden in variables and attribute expressions', () => {
    const source = "const label = 'Untranslated'; const view = <button aria-label={'Raw label'}>{label}</button>;";
    expect(untranslatedText('fixture.tsx', source)).toEqual(['Raw label', 'Untranslated']);
  });

  it('formats numbers according to the selected language', () => {
    const spanishResult = renderHook(() => useTranslation(), {
      wrapper: ({ children }) => <LocaleProvider locale="es">{children}</LocaleProvider>,
    });
    const englishResult = renderHook(() => useTranslation(), {
      wrapper: ({ children }) => <LocaleProvider locale="en">{children}</LocaleProvider>,
    });
    expect(spanishResult.result.current.formatNumber(48.3)).toBe('48,3');
    expect(englishResult.result.current.formatNumber(48.3)).toBe('48.3');
    expect(spanishResult.result.current.formatNumber(0.483, { style: 'percent', maximumFractionDigits: 1 })).toBe('48,3%');
    expect(englishResult.result.current.formatNumber(0.483, { style: 'percent', maximumFractionDigits: 1 })).toBe('48.3%');
  });
});
