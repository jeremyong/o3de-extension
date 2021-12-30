import {
	languages,
	window,
	ExtensionContext,
	workspace,
	TextDocument,
	DocumentFilter,
	DefinitionProvider,
	Position,
	CancellationToken,
	Definition,
	DefinitionLink,
} from 'vscode';

const passFilter: DocumentFilter[] = [
	{language: 'jsonc', pattern: '**/*.pass', scheme: 'file'},
	{language: 'json', pattern: '**/*.pass', scheme: 'file'},
	{language: 'jsonc', pattern: '**/*.shader', scheme: 'file'},
	{language: 'json', pattern: '**/*.shader', scheme: 'file'},
	{language: 'hlsl', pattern: '**/*.azsl', scheme: 'file'},
	{language: 'hlsl', pattern: '**/*.azsli', scheme: 'file'},
	{language: 'hlsl', pattern: '**/*.srgi', scheme: 'file'},
];

function stripEndpoints(word: string) {
	if (word.length < 2) { return word; }
	return word.substring(1, word.length - 1);
}

const definitionProvider: DefinitionProvider = {
	async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<null | Definition | DefinitionLink[]> {
		const range = document.getWordRangeAtPosition(position, /['"<]([\w/\.]+)['">]/);
		if (!range) {
			return null;
		}

		let word = stripEndpoints(document.getText(range));

		if (word.includes('.shader') || word.includes('.azsl') || word.includes('.azsli') || word.includes('srgi')) {
			const results = await workspace.findFiles('**/' + word);
			if (results.length > 0) {
				// We opt to use showTextDocument instead of return a location to preserve any existing cursor position
				// and selection within the document if already opened
				window.showTextDocument(results[0]);
				return null;
			}
		}

		return null;
	},
};

export function activate(context: ExtensionContext) {
	console.log('O3DE extension active');

	context.subscriptions.push(languages.registerDefinitionProvider(passFilter, definitionProvider));
}

export function deactivate() {}
