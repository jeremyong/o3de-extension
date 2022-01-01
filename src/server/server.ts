import {
    createConnection,
    DefinitionParams,
    DidChangeConfigurationNotification,
    DidChangeTextDocumentParams,
    InitializeParams,
    InitializeResult,
    Location,
    Position,
    ProposedFeatures,
    TextDocumentContentChangeEvent,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import {
    Range
} from 'vscode';
import TextMirror from './TextMirror';

import * as Parser from 'web-tree-sitter';
import { readFile } from 'fs';
import { loadParser } from './Parser';
import { analyze, documents, mightBeFunctionCall, queryFunction, parse } from './Analysis';

// Connect to the extension client via IPC
let connection = createConnection(ProposedFeatures.all);

let hasConfigCap = false;
let hasWorkspaceFolderCap = false;
let hasDiagnosticCap = false;

function posToPoint(position: Position): Parser.Point {
    return {row: position.line, column: position.character};
}

connection.onInitialize(async (params: InitializeParams) => {
    console.log('AZSL LSP client initializing');
    await loadParser();

    const caps = params.capabilities;

    hasConfigCap = !!(caps.workspace && !! caps.workspace.configuration);
    hasWorkspaceFolderCap = !!(caps.workspace && !!caps.workspace.workspaceFolders);
    hasDiagnosticCap = !!(caps.textDocument && caps.textDocument.publishDiagnostics && caps.textDocument.publishDiagnostics.relatedInformation);

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            definitionProvider: true,

            // Advertise code completion capabilities
            // completionProvider: {
                // resolveProvider: true,
            // }
            hoverProvider: true,
        }
    };
    if (hasWorkspaceFolderCap) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigCap) {
        connection.client.register(DidChangeConfigurationNotification.type);
    }
    if (hasWorkspaceFolderCap) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received');
        });
    }
    console.log('AZSL LSP server connection initialized');
});

connection.onDidOpenTextDocument(async (params) => {
    const doc = params.textDocument;
    console.debug(`${doc.uri} opened`);
    let data = documents.get(doc.uri);
    if (!data || data.version < params.textDocument.version) {
        const tree = await parse(doc.uri, doc.text);
        documents.set(doc.uri, {
            uri: doc.uri,
            tree,
            version: doc.version,
            text: new TextMirror(doc.text),
            symbolTable: await analyze(doc.uri, tree),
        });
    }
});

connection.onDidCloseTextDocument((params) => {
    console.debug(`${params.textDocument.uri} closed`);
});

// Emitted on doc change and open
connection.onDidChangeTextDocument(async (params: DidChangeTextDocumentParams) => {
    const doc = params.textDocument;

    let docData = documents.get(doc.uri);

    for (let i = 0; i !== params.contentChanges.length; ++i) {
        const change: TextDocumentContentChangeEvent = params.contentChanges[i];
        if (TextDocumentContentChangeEvent.isFull(change)) {
            const tree = await parse(doc.uri, change.text);
            documents.set(doc.uri, {
                uri: doc.uri,
                tree,
                version: params.textDocument.version,
                text: new TextMirror(change.text),
                symbolTable: await analyze(doc.uri, tree),
            });
        } else if (docData && docData.tree && TextDocumentContentChangeEvent.isIncremental(change)) {
            // Incremental parse update
            const { range, text } = change as {range: Range, text: string};
            const startIndex = docData.text.getOffset(range.start);
            const oldEndIndex = docData.text.getOffset(range.end);
            const newEndIndex = startIndex + text.length;
            docData.tree.edit({
                startIndex,
                oldEndIndex,
                newEndIndex,
                startPosition: { row: range.start.line, column: range.start.character },
                oldEndPosition: docData.tree.rootNode.descendantForIndex(startIndex, oldEndIndex).endPosition,
                newEndPosition: { row: range.end.line, column: range.end.character },
            });
            docData.text.applyChange(change);
            docData.tree = await parse(doc.uri, docData.text.text, docData.tree);
            docData.symbolTable = await analyze(doc.uri, docData.tree);
        } else {
            readFile(doc.uri, 'utf8', async (err, data) => {
                if (!err) {
                    const tree = await parse(doc.uri, data);
                    documents.set(doc.uri, {
                        uri: doc.uri,
                        tree,
                        version: params.textDocument.version,
                        text: new TextMirror(data),
                        symbolTable: await analyze(doc.uri, tree),
                    });
                }
            });
            return;
        }
    }
});

connection.onDefinition((params: DefinitionParams, token, workDoneProgress, resultProgress): Location | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !doc.symbolTable) {
        return null;
    }

    const node = doc.tree.rootNode.namedDescendantForPosition(posToPoint(params.position));
    if (mightBeFunctionCall(node)) {
        const result = queryFunction(node.text, doc);
        if (result) {
            let pos = {
                line: result.fn.node.startPosition.row,
                character: result.fn.node.startPosition.column,
            };
            return Location.create(result.uri, {start: pos, end: pos});
        }
    }

    return null;
});

connection.onHover((params, token, workDoneProgress, resultProgress) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !doc.symbolTable) {
        return null;
    }

    const node = doc.tree.rootNode.namedDescendantForPosition(posToPoint(params.position));

    if (mightBeFunctionCall(node)) {
        // Treat this node as a function
            
        const result = queryFunction(node.text, doc);
        if (result && result.fn) {
            let value = result.fn.text;
            if (result.fn.comment) {
                value = `${result.fn.comment}\n${value}`;
            }
            return {
                contents: {
                    kind: 'markdown',
                    value: `\`\`\`hlsl\n${value}\n\`\`\``,
                },
            };
        }
    }

    return null;
    // Uncomment below to examine AST node data
    /*
    return {
        contents: {
            kind: 'markdown',
            value: node.type,
        }
    };
    */
});

connection.listen();