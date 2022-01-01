import * as assert from 'assert';
import path = require('path');
import * as util from 'util';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { analyze } from '../../server/Analysis';
import { loadParser, parseFile } from '../../server/Parser';
// import * as myExtension from '../../extension';

const rootPath = path.join(__dirname, '..', '..', '..', 'src', 'test');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Parser test', async () => {
		const tree = await parseFile(path.join(rootPath, 'test.hlsl'));

		// console.log(tree.rootNode.toString());
		/*
		const functions = tree.rootNode.descendantsOfType('leadingTypeFunctionSignature');
		functions.forEach((node) => {
			const ids = node.descendantsOfType('identifier');
			console.log(node.text);
			if (ids.length > 0) {
				console.log(ids[0].text);
			}
		});
		*/

		// const table = analyze(tree);
		// console.log(util.inspect(table));
	});
});
