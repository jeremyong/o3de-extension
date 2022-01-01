import * as path from 'path';
import {
    ExtensionContext, TextDocument, Uri, workspace,
} from "vscode";
import {
    CloseAction,
    ErrorAction,
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { loadParser } from './server/Parser';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    let serverModule = context.asAbsolutePath(path.join('out', 'server', 'server.js'));
    console.log(serverModule);
    let serverOpts: ServerOptions = {
        run: {module: serverModule, transport: TransportKind.ipc},
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009']}
            // Uncomment below and comment above to break the debugger at LSP server start
            // options: { execArgv: ['--nolazy', '--inspect=6009', '--inspect-brk']}
        }
    };

    let clientOpts: LanguageClientOptions = {
        documentSelector: [{scheme: 'file', language: 'azsl'}],
        errorHandler: {
            error(error, message, count) {
                console.log(error, message);
                return ErrorAction.Shutdown;
            },
            closed() {
                console.log('Server closed');
                return CloseAction.DoNotRestart;
            }
        }
    };

    client = new LanguageClient('azslLanguageServer', 'AZSL Language Server', serverOpts, clientOpts);

    client.start();
    workspace.textDocuments.forEach(scanIncludes);
    context.subscriptions.push(workspace.onDidOpenTextDocument(scanIncludes));
}

async function scanIncludes(doc: TextDocument) {
    if (doc.languageId !== 'azsl') {
        return;
    }

    let parser = await loadParser();
    const tree = parser.parse(doc.getText());
    const incs = tree.rootNode.descendantsOfType('includeFile');
    incs.forEach(async (node) => {
        // Create a dummy hover request for each include file to ensure they are parsed
		const results = await workspace.findFiles('**/' + node.text);
		if (results.length > 0) {
            const next = await workspace.openTextDocument(results[0]);
            scanIncludes(next);
        }
    });
}

export function deactivate() {
    if (client) {
        client.stop();
    }
}