import type { ClientState } from '@client/client-state';
import { getCurrentProjectInWorkspaceRootFsPath } from '@shared/config';
import type { CompilerError, TestFunctionResult } from '@shared/types';
import * as vscode from 'vscode';
import { forgeErrorsToDiagnostics, parseForgeErrorsFromStdOut, testDiagnosticsMap } from '../diagnostics';

// const solcErrorRegexp = () => /Error \((\d+)\): (.+)\n.*?\S+.(.+):(\d+):(\d+)/gm;
export const solcErrorRegexp = () => /Error.*?\((\d+)\).*?:.*?(.+)\n.*?\S+.(.+):(\d+):(\d+)/gm;
export const replaceShellColors = (str: string) =>
	str
		.replace(/\[\d{0,2}m/gm, '')
		.replace(/\\x1B|\[\d;\d+\S|\|/gm, '')
		.replace(/(\r\n|\n|\r)/gm, '\n');

export const handleTestResult = (
	state: ClientState,
	args: [string, vscode.TextDocument, vscode.Range],
	stdout: string,
	err: Error
): TestFunctionResult => {
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
			errors.push(parseForgeErrorsFromStdOut(match, getCurrentProjectInWorkspaceRootFsPath()));
		}

		forgeErrorsToDiagnostics(state, errors);
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

	testDiagnosticsMap.set(functionName, diagnostics);
	state.diagnosticsTest.set(document.uri, Array.from(testDiagnosticsMap.values()).flat());

	const testLine = lines.find((line) => line.indexOf(functionName) !== -1) ?? `Test: ${functionName}`;
	const textResult = `${testLine.trim().slice(1)}\n\n${logLines
		.map((s) => {
			if (s.indexOf('Right:') !== -1) {
				return ` - ${s.trim()}\n`;
			}
			if (s.indexOf('Left:') !== -1) {
				return ` - ${s.trim()}`;
			}
			if (s.indexOf('Assertion Failed') !== -1) {
				return `\n${s.trim()}\n`;
			}
			return s.trim();
		})
		.join('\n')}`;
	return {
		result: textResult,
		resultDecor: {
			text: textResult,
			line: range.start.line,
			scope: functionName,
			type: isFail ? 'fail' : 'success',
		},
		info: isFail ? '  🛑' : '  🟢',
		isFail,
		isError: false,
		err: err,
	} as const;
};
