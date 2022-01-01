import { Position, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import { Range, uinteger } from "vscode-languageserver/node";

interface TextLine {
    offset: number;
}

// Scan 
function splitOffset(text: string) {
    let results = [];
    let offset;
    const re = /\r?\n/g;
    while (offset = re.lastIndex, re.exec(text)) {
        results.push({
            offset,
        });
    }
    results.push({
        offset,
    });
    return results;
}

export default class TextMirror
{
    _text: string;
    _lines: TextLine[];

    constructor(text: string)
    {
        this._text = text;
        this._lines = splitOffset(text);
    }

    get text(): string {
        return this._text;
    }

    getOffset(position: Position) {
        return this._lines[position.line].offset + position.character;
    }

    applyChange({range, rangeLength, text}: {range: Range, rangeLength: uinteger, text: string}) {
        // Lookup byte offset of the line
        const startOffset = this.getOffset(range.start);
        const endOffset = this.getOffset(range.end);

        // Perform replacement
        this._text = this._text.substring(0, startOffset) + text + this._text.substring(endOffset);
        this._lines = splitOffset(this._text);
    }
}