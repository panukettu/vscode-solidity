import * as cp from 'child_process';
import * as vscode from 'vscode';
import { stdoutToDiagnostics } from '../../server/providers/utils/diagnostics';
import { CompilerError } from '../../server/types';
import * as workspaceUtil from '../workspaceUtil';
import { forgeErrorsToDiagnostics } from '../solErrorsToDiaganosticsClient';
import { lineDecoration } from '../decorations';

type TestId<T extends string> = `${T}()`;
type ForgeTestJson<T extends string = ''> = {
	duration: {
		secs: number;
		nanos: number;
	};
	test_results: {
		[key in TestId<T>]: {
			status: 'Failure' | 'Success';
			logs: any[];
			decoded_logs: string[];
			kind: {
				Standard: number;
				traces: any[];
				labeled_addresses: object;
				debug: any;
				breakpoints: any;
				warnings: any[];
			};
		};
	};
};
export async function formatDocument(
	document: vscode.TextDocument,
	context: vscode.ExtensionContext
): Promise<vscode.TextEdit[]> {
	const firstLine = document.lineAt(0);
	const lastLine = document.lineAt(document.lineCount - 1);
	const fullTextRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
	const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
	const formatted = await formatDocumentInternal(document.getText(), rootPath);
	return [vscode.TextEdit.replace(fullTextRange, formatted)];
}

// const solcErrorRegexp = () => /Error \((\d+)\): (.+)\n.*?\S+.(.+):(\d+):(\d+)/gm;
const solcErrorRegexp = () => /Error.*?\((\d+)\).*?:.*?(.+)\n.*?\S+.(.+):(\d+):(\d+)/gm;
const replaceShellColors = (str: string) =>
	str
		.replace(/\[\d{0,2}m/gm, '')
		.replace(/\\x1B|\[\d;\d+\S|\|/gm, '')
		.replace(/(\r\n|\n|\r)/gm, '\n');

let diagnosticCollection: vscode.DiagnosticCollection;
let diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
export function initTestDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
	diagnosticCollection = diagnostics;
}
export function clearTestDiagnostics() {
	diagnosticCollection.clear();
	diagnosticsMap.clear();
}

async function formatDocumentInternal(documentText: string, rootPath: string): Promise<string> {
	return await new Promise<string>((resolve, reject) => {
		const forge = cp.execFile('forge', ['fmt', '--raw', '-'], { cwd: rootPath }, (err, stdout) => {
			if (err != null) {
				console.error(err);
				return reject(err);
			}

			resolve(stdout);
		});

		forge.stdin?.write(documentText);
		forge.stdin?.end();
	});
}

const handleTestResult = (args: [string, vscode.TextDocument, vscode.Range], stdout: string, err: Error): TestRun => {
	if (!stdout || stdout.length === 0)
		return {
			info: undefined,
			isFail: false,
			isError: true,
			err: null,
		};

	const [functionName, document, range] = args;
	const isError = stdout.indexOf(functionName) === -1 && err != null;

	if (isError) {
		const regexp = solcErrorRegexp();
		const errorMessage = replaceShellColors(err.message);
		const errors: CompilerError[] = [];

		let match: string[] | null = null;
		// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
		while ((match = regexp.exec(errorMessage)) !== null) {
			errors.push(stdoutToDiagnostics(match, workspaceUtil.getCurrentProjectInWorkspaceRootFsPath()));
		}

		forgeErrorsToDiagnostics(diagnosticCollection, errors);
		return {
			// @ts-expect-error
			info: err.killed ? 'Test restarted.' : 'Test compilation failed.',
			isFail: false,
			isError: true,
			err: err,
		};
	}
	// const result = JSON.parse(stdout) as ForgeTestJson<typeof arg>;
	const isFail = stdout.indexOf('FAIL') !== -1;
	const lines = stdout
		.replace(/\[\d{0,2}m/gm, '')
		.replace(/(\r\n|\n|\r)/gm, '\n')
		.split('\n');

	const logStartIndex = lines.findIndex((line) => line.indexOf('Logs:') !== -1);
	const logEndIndex = lines.findIndex((line) => line.indexOf('Test result:') !== -1);
	const logLines = lines.slice(logStartIndex + 1, logEndIndex - 1);

	const logLineIds = logLines.map((line, index) => {
		const split = line.split(':').map((s) => s.trim());
		if (split.length < 2)
			return {
				type: 'None',
				severity: vscode.DiagnosticSeverity.Information,
				key: '',
				value: '',
			};
		if (split[0] === 'Error') {
			const isEqTest = logLines[index + 1].indexOf('==') !== -1 || logLines[index + 1].indexOf('!=') !== -1;
			return {
				type: 'Error',
				severity: vscode.DiagnosticSeverity.Error,
				key: split[1],
				value: isEqTest
					? logLines
							.slice(index + 1, index + 4)
							.map((s) => s.trim())
							.join('\n')
					: logLines[index + 1],
			};
		} else {
			return {
				type: 'Log',
				severity: vscode.DiagnosticSeverity.Information,
				key: split[0],
				value: split.map((s) => s.trim()).join('\n'),
			};
		}
	});

	const docText = document.getText(range);
	const offset = document.offsetAt(range.start);

	const diagnostics = logLineIds
		.map((log) => {
			const id = log.key;
			if (id === '') return null;

			const foundDoubleQuote = docText.indexOf(`"${id}"`);
			const foundSingleQuote = docText.indexOf(`'${id}'`);
			if (foundDoubleQuote === -1 && foundSingleQuote === -1) return null;

			const foundIndex = foundDoubleQuote !== -1 ? foundDoubleQuote : foundSingleQuote;

			const line = document.lineAt(document.positionAt(offset + foundIndex).line);
			return new vscode.Diagnostic(
				new vscode.Range(new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex), line.range.end),
				`${functionName}()\n${log.value}`,
				log.severity
			);
		})
		.filter((d) => d !== null);

	diagnosticsMap.set(functionName, diagnostics);
	diagnosticCollection.set(document.uri, Array.from(diagnosticsMap.values()).flat());

	const testLine = lines.find((line) => line.indexOf(functionName) !== -1) ?? 'Test: ' + functionName;

	return {
		result:
			testLine.trim().slice(1) +
			'\n\n' +
			logLines
				.map((s) => {
					if (s.indexOf('Right:') !== -1) {
						return ' - ' + s.trim() + '\n';
					}
					if (s.indexOf('Left:') !== -1) {
						return ' - ' + s.trim();
					}
					if (s.indexOf('Assertion Failed') !== -1) {
						return '\n' + s.trim() + '\n';
					}
					return s.trim();
				})
				.join('\n'),
		info: isFail ? 'Test failed.' : 'Test passed.',
		isFail,
		isError: false,
		err: err,
	};
};

type TestRun = {
	result?: string;
	info: string;
	isFail: boolean;
	isError: boolean;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	err: any;
};
const processMap = new Map<string, cp.ChildProcess>();
export function runForgeTest(args: [string, vscode.TextDocument, vscode.Range], rootPath: string): Promise<TestRun> {
	return new Promise((resolve, reject) => {
		const functionName = args[0];
		diagnosticsMap.set(functionName, []);
		diagnosticCollection.set(args[1].uri, Array.from(diagnosticsMap.values()).flat());

		const wordBound = functionName + '\\b';
		if (processMap.has(functionName)) {
			processMap.get(functionName)?.kill();
		}
		processMap.set(
			functionName,
			cp.execFile('forge', ['test', '--mt', wordBound, '-vv'], { cwd: rootPath }, (err, stdout) => {
				const result = handleTestResult(args, stdout, err);
				processMap.delete(functionName);
				return resolve(result);
			})
		);
	});
}
