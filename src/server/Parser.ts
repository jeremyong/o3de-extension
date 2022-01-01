import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import { readFile } from 'fs/promises';

let parser: Parser | undefined;

export async function loadParser(): Promise<Parser> {
    if (parser) {
        return parser;
    }

    await Parser.init();

    const wasmPath = path.join(__dirname, '..', '..', 'tree-sitter-azsl.wasm');
    console.time('wasm load');
    const AZSL = await Parser.Language.load(wasmPath);
    console.timeEnd('wasm load');
    parser = new Parser();
    parser.setLanguage(AZSL);

    console.log('AZSL parser loaded');

    return parser;
}

export async function parseFile(file: string): Promise<Parser.Tree> {
    const text = await readFile(file, 'utf-8');
    const p = await loadParser();
    return p.parse(text);
}