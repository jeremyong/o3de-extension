import { dirname, resolve } from 'path';
import { pathToFileURL } from 'url';
import * as Parser from 'web-tree-sitter';
import { loadParser } from './Parser';
import TextMirror from './TextMirror';

export interface DocumentData
{
    uri: string;
    tree: Parser.Tree;
    version: number;
    text: TextMirror;
    symbolTable: SymbolTable,
}

export let documents = new Map<string, DocumentData>();

class AzslFunction
{
    // leadingTypeFunctionSignature
    constructor(node: Parser.SyntaxNode) {
        this.node = node;
        this.text = node.text;
        const ids = node.descendantsOfType('identifier');
        if (ids.length > 0) {
            this.name = ids[0].text;
        }
        if (node.parent && node.parent.parent &&
            node.parent.parent.previousNamedSibling &&
            node.parent.parent.previousNamedSibling.type === 'comment') {
            this.comment = node.parent.parent.previousNamedSibling.text;
        }
    }

    text: string;
    name?: string;
    comment?: string;
    node: Parser.SyntaxNode;
}

export class SymbolTable
{
    includes: Set<string> = new Set();
    functions: Map<string, AzslFunction> = new Map();
}

let symbolTables = new Map<string, SymbolTable>();

// (argumentList (expression (idExpression (identifier))) (expression (idExpression (identifier))))
export function mightBeFunctionCall(node: Parser.SyntaxNode): boolean {
    if (node.type === 'identifier') {
        let maybeExp = node.parent?.parent;
        let maybeArgList = maybeExp?.nextNamedSibling;
        if (!maybeArgList) {
            maybeExp = node.parent?.parent?.parent?.parent;
            maybeArgList = maybeExp?.nextNamedSibling;
        }
        if (maybeArgList && maybeArgList.type === 'argumentList') {
            return true;
        }
    }
    return false;
}

export function queryFunction(fn: string, doc: DocumentData): null | {fn: AzslFunction, uri: string} {
    let result = doc.symbolTable.functions.get(fn);
    if (result) {
        return {
            fn: result,
            uri: doc.uri,
        };
    }

    for (let inc of doc.symbolTable.includes.values()) {
        let incDoc = documents.get(inc);
        if (incDoc) {
            result = incDoc.symbolTable.functions.get(fn);
            if (result) {
                return {
                    fn: result,
                    uri: incDoc.uri,
                };
            }
        }
    }

    return null;
}

export async function parse(uri: string, text: string, tree?: undefined | Parser.Tree): Promise<Parser.Tree> {
    let parser = await loadParser();
    console.time(`Parsing file: ${uri}`);
    const result = parser.parse(text, tree);
    console.timeEnd(`Parsing file: ${uri}`);

    return result;
}

async function tryResolveInclude(uri: string, text: string): Promise<string | null> {
    // First, check if this is a relative include
    if (text.length > 0 && text[0] === '.') {
        let dir = dirname(uri);
        let path = resolve(dir, text);
        return pathToFileURL(path).toString();
    }

    // Search existing docs
    for (let it of documents.keys()) {
        if (it.endsWith(text)) {
            return it;
        }
    }

    return null;
}

let unresolvedIncludes = new Map<string, SymbolTable>();

export async function analyze(uri: string, tree: Parser.Tree): Promise<SymbolTable> {
    if (uri.endsWith('.azsli') || uri.endsWith('.srgi')) {
        // Check if this file corresponds with any unresolved includes
        for (let it of unresolvedIncludes.keys()) {
            let maybeInclude = await tryResolveInclude(uri, it);
            if (maybeInclude) {
                unresolvedIncludes.get(it)?.includes.add(maybeInclude);
                unresolvedIncludes.delete(it);
            }
        }
    }

    let symbolTable = symbolTables.get(uri);
    if (!symbolTable) {
        symbolTable = new SymbolTable();
        symbolTables.set(uri, symbolTable);
    }

    const functions = tree.rootNode.descendantsOfType('leadingTypeFunctionSignature');
    functions.forEach((node) => {
        const fn = new AzslFunction(node);
        if (fn.name) {
            symbolTable!.functions.set(fn.name, fn);
        }
    });
    const includes = tree.rootNode.descendantsOfType('includeFile');
    includes.forEach(async (node) => {
        let maybeInclude = await tryResolveInclude(uri, node.text);
        if (maybeInclude) {
            symbolTable!.includes.add(maybeInclude);
        } else {
            unresolvedIncludes.set(node.text, symbolTable!);
        }
    });
    return symbolTable;
}