import { validarSecuencia } from './secuencia';

export interface EntradaFasta {
  numero: number;
  encabezado: string;
  secuencia: string;
  posicionesInvalidas: number[];
}

/** Analizador incremental de FASTA independiente del navegador. */
export class AnalizadorFasta {
  private lineaPendiente = '';
  private encabezado: string | null = null;
  private partes: string[] = [];
  private numeroLinea = 0;
  private numeroEntrada = 0;

  /** Consume un bloque de texto y devuelve únicamente las entradas que ya terminaron. */
  agregar(bloque: string): EntradaFasta[] {
    const texto = this.lineaPendiente + bloque;
    const terminaEnRetorno = texto.endsWith('\r');
    const lineas = (terminaEnRetorno ? texto.slice(0, -1) : texto).split(/\r\n|\n|\r/);
    this.lineaPendiente = (lineas.pop() ?? '') + (terminaEnRetorno ? '\r' : '');
    const entradas: EntradaFasta[] = [];
    for (const linea of lineas) {
      const entrada = this.procesarLinea(linea);
      if (entrada) entradas.push(entrada);
    }
    return entradas;
  }

  /** Procesa el último renglón y emite la última entrada. */
  finalizar(): EntradaFasta[] {
    const entradas: EntradaFasta[] = [];
    if (this.lineaPendiente) {
      for (const linea of this.lineaPendiente.split(/\r\n|\n|\r/)) {
        if (!linea) continue;
        const entrada = this.procesarLinea(linea);
        if (entrada) entradas.push(entrada);
      }
    }
    this.lineaPendiente = '';
    if (this.encabezado !== null) entradas.push(this.cerrarEntrada());
    if (entradas.length === 0 && this.numeroEntrada === 0) {
      throw new Error('El archivo FASTA no contiene entradas.');
    }
    return entradas;
  }

  private procesarLinea(linea: string): EntradaFasta | null {
    this.numeroLinea += 1;
    if (linea.startsWith('>')) {
      const nuevoEncabezado = linea.slice(1).trim();
      if (!nuevoEncabezado) throw new Error(`La cabecera de la línea ${String(this.numeroLinea)} está vacía.`);
      const anterior = this.encabezado === null ? null : this.cerrarEntrada();
      this.encabezado = nuevoEncabezado;
      return anterior;
    }
    if (!linea.trim()) return null;
    if (this.encabezado === null) {
      throw new Error(`Se esperaba una cabecera FASTA antes de la línea ${String(this.numeroLinea)}.`);
    }
    this.partes.push(linea);
    return null;
  }

  private cerrarEntrada(): EntradaFasta {
    const secuencia = this.partes.join('').replace(/[a-z]/g, (caracter) => caracter.toUpperCase());
    if (!secuencia) {
      throw new Error(`La entrada «${String(this.encabezado)}» no contiene secuencia.`);
    }
    this.numeroEntrada += 1;
    const entrada = {
      numero: this.numeroEntrada,
      encabezado: this.encabezado ?? '',
      secuencia,
      posicionesInvalidas: validarSecuencia(secuencia).posicionesInvalidas,
    };
    this.partes = [];
    this.encabezado = null;
    return entrada;
  }
}
