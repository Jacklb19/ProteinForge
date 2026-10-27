export type TranslationVariables = Record<string, string | number>;

/** Replaces `{{name}}` placeholders; an unknown name stays visible, so a missing value is noticed. */
export function fillMessage(template: string, variables: TranslationVariables = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(variables[name] ?? `{{${name}}}`));
}
