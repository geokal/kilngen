import { isMap, isNode, isPair, isScalar, LineCounter, parseDocument, type Document } from "yaml";
import { diagnostic, type Diagnostic, type SourceLocation } from "./diagnostics.js";

export type DocPath = (string | number)[];

/** A parsed YAML/JSON file that can map a data path back to a line and column. */
export class SourceFile {
  private constructor(
    readonly file: string,
    readonly doc: Document,
    private readonly lines: LineCounter,
  ) {}

  static parse(file: string, text: string): { source: SourceFile; diagnostics: Diagnostic[] } {
    const lines = new LineCounter();
    const doc = parseDocument(text, { lineCounter: lines, uniqueKeys: true, prettyErrors: false });
    const source = new SourceFile(file, doc, lines);
    const diagnostics = doc.errors.map((e) =>
      diagnostic("K0001", e.message.split("\n")[0] ?? e.message, {
        location: source.offsetToLocation(e.pos[0]),
      }),
    );
    return { source, diagnostics };
  }

  toJS(): unknown {
    return this.doc.toJS();
  }

  offsetToLocation(offset: number): SourceLocation {
    const { line, col } = this.lines.linePos(offset);
    return { file: this.file, line, column: col };
  }

  /** Location of the value at `path`, or of its nearest existing ancestor. */
  locate(path: DocPath): SourceLocation {
    for (let i = path.length; i >= 0; i--) {
      const node = i === 0 ? this.doc.contents : this.doc.getIn(path.slice(0, i), true);
      if (isNode(node) && node.range) return this.offsetToLocation(node.range[0]);
    }
    return { file: this.file };
  }

  /** Location of the key `key` inside the map at `parentPath`. */
  locateKey(parentPath: DocPath, key: string): SourceLocation {
    const parent = parentPath.length === 0 ? this.doc.contents : this.doc.getIn(parentPath, true);
    if (isMap(parent)) {
      for (const pair of parent.items) {
        if (isPair(pair) && isScalar(pair.key) && String(pair.key.value) === key && pair.key.range) {
          return this.offsetToLocation(pair.key.range[0]);
        }
      }
    }
    return this.locate(parentPath);
  }
}
