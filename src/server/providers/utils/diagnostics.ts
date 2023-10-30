import { DiagnosticSeverity } from 'vscode-languageserver';
import { CompilerError } from '../../types';

export function getDiagnosticSeverity(severity: string): DiagnosticSeverity {
	switch (severity) {
		case 'error':
			return DiagnosticSeverity.Error;
		case 'warning':
			return DiagnosticSeverity.Warning;
		case 'info':
			return DiagnosticSeverity.Information;
		default:
			return DiagnosticSeverity.Error;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function errorToDiagnostic(error: any): CompilerError {
	if (error.sourceLocation.file != null) {
		const fileName = error.sourceLocation.file;

		const errorSplit = error.formattedMessage.substr(error.formattedMessage.indexOf(fileName)).split(':');
		let index = 1;
		// a full path in windows includes a : for the drive
		if (process.platform === 'win32') {
			index = 2;
		}

		return splitErrorToDiagnostic(error, errorSplit, index, fileName);
	} else {
		const errorSplit = error.formattedMessage.split(':');
		let fileName = errorSplit[0];
		let index = 1;

		// a full path in windows includes a : for the drive
		if (process.platform === 'win32') {
			fileName = `${errorSplit[0]}:${errorSplit[1]}`;
			index = 2;
		}

		return splitErrorToDiagnostic(error, errorSplit, index, fileName);
	}
}

export function splitErrorToDiagnostic(error: any, errorSplit: any, index: number, fileName: any): CompilerError {
	const severity = getDiagnosticSeverity(error.severity);
	const errorMessage = error.message;
	// tslint:disable-next-line:radix
	let line = parseInt(errorSplit[index]);
	if (Number.isNaN(line)) {
		line = 1;
	}
	// tslint:disable-next-line:radix
	let column = parseInt(errorSplit[index + 1]);
	if (Number.isNaN(column)) {
		column = 1;
	}

	let startCharacter = column - 1;

	let endCharacter = column + error.sourceLocation.end - error.sourceLocation.start - 1;
	if (endCharacter < 0) {
		endCharacter = 1;
	}

	let endLine = line - 1;
	let startLine = line - 1;

	if (error.code === '1878') {
		startLine = 0;
		endLine = 2;
		endCharacter = 0;
		startCharacter = 1;
	}

	const result = {
		diagnostic: {
			message: errorMessage,
			code: error.errorCode,
			range: {
				end: {
					character: endCharacter,
					line: endLine,
				},
				start: {
					character: startCharacter,
					line: startLine,
				},
			},
			severity: severity,
		},
		fileName: fileName,
	};

	return result;
}

export function stdoutToDiagnostics(match: string[], rootPath: string): CompilerError {
	const [, code, message, fileName, line, character] = match;
	const position = { line: parseInt(line) - 1, character: parseInt(character) };
	const result = {
		diagnostic: {
			message: message.trim(),
			code: code.trim(),
			range: {
				start: position,
				end: position,
			},
			severity: 1,
		},
		fileName: `${rootPath}/${fileName}`,
	};
	return result;
}
