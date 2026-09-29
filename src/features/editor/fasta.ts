import { validateSequence } from './sequence';

export interface FastaEntry {
  number: number;
  header: string;
  sequence: string;
  invalidPositions: number[];
}

/** Incremental FASTA parser independent of the browser. */
export class FastaParser {
  private pendingLine = '';
  private header: string | null = null;
  private parts: string[] = [];
  private lineNumber = 0;
  private entryNumber = 0;

  /** Consumes a text chunk and returns only completed entries. */
  addChunk(chunk: string): FastaEntry[] {
    const text = this.pendingLine + chunk;
    const endsWithCarriageReturn = text.endsWith('\r');
    const lines = (endsWithCarriageReturn ? text.slice(0, -1) : text).split(/\r\n|\n|\r/);
    this.pendingLine = (lines.pop() ?? '') + (endsWithCarriageReturn ? '\r' : '');
    const entries: FastaEntry[] = [];
    for (const line of lines) {
      const entry = this.processLine(line);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  /** Processes the last line and emits the final entry. */
  finish(): FastaEntry[] {
    const entries: FastaEntry[] = [];
    if (this.pendingLine) {
      for (const line of this.pendingLine.split(/\r\n|\n|\r/)) {
        if (!line) continue;
        const entry = this.processLine(line);
        if (entry) entries.push(entry);
      }
    }
    this.pendingLine = '';
    if (this.header !== null) entries.push(this.closeEntry());
    if (entries.length === 0 && this.entryNumber === 0) {
      throw new Error('El archivo FASTA no contiene entradas.');
    }
    return entries;
  }

  private processLine(line: string): FastaEntry | null {
    this.lineNumber += 1;
    if (line.startsWith('>')) {
      const newHeader = line.slice(1).trim();
      if (!newHeader) throw new Error(`La cabecera de la línea ${String(this.lineNumber)} está vacía.`);
      const previous = this.header === null ? null : this.closeEntry();
      this.header = newHeader;
      return previous;
    }
    if (!line.trim()) return null;
    if (this.header === null) {
      throw new Error(`Se esperaba una cabecera FASTA antes de la línea ${String(this.lineNumber)}.`);
    }
    this.parts.push(line);
    return null;
  }

  private closeEntry(): FastaEntry {
    const sequence = this.parts.join('').replace(/[a-z]/g, (character) => character.toUpperCase()).replace(/\*$/, '');
    if (!sequence) {
      throw new Error(`La entrada «${String(this.header)}» no contiene secuencia.`);
    }
    this.entryNumber += 1;
    const entry = {
      number: this.entryNumber,
      header: this.header ?? '',
      sequence,
      invalidPositions: validateSequence(sequence).invalidPositions,
    };
    this.parts = [];
    this.header = null;
    return entry;
  }
}
