export interface AlturaFila {
  pixeles: number;
  respaldoDeEmergencia: boolean;
}

function leerPixeles(valor: string): number | null {
  const texto = valor.trim();
  if (!/^\d+(?:\.\d+)?px$/.test(texto)) return null;
  const pixeles = Number.parseFloat(texto);
  return Number.isFinite(pixeles) && pixeles > 0 ? pixeles : null;
}

/** Usa el valor CSS válido, su token de respaldo o una altura mínima segura. */
export function resolverAlturaFila(valorCss: string, respaldoCss: string): AlturaFila {
  const principal = leerPixeles(valorCss);
  if (principal !== null) return { pixeles: principal, respaldoDeEmergencia: false };
  const respaldo = leerPixeles(respaldoCss);
  if (respaldo !== null) return { pixeles: respaldo, respaldoDeEmergencia: false };
  return { pixeles: 1, respaldoDeEmergencia: true };
}
