import * as cp from 'child_process';
import type { ClientState } from '@client/client-state';
import { ProcessOut, TestExec } from '@client/types';
import { Config } from '@shared/config';
import { ExecStatus } from '@shared/enums';
import type { Lens } from '../../code-lens-types';
import {
	clearAllFoundryDiagnosticScopes,
	handleTestCompilerErrorDiagnostic,
	handleTestDiagnostic,
} from '../diagnostics/foundry-diagnostics';
import { parseOutput } from '../stdout-parser';

const processMap = new Map<string, cp.ChildProcess>();

export function execForgeTestFunction(
	state: ClientState,
	args: Lens.ForgeTestExec,
	rootPath: string,
	forceTrace = false
) {
	return new Promise<TestExec.Result | TestExec.Restart | TestExec.Unhandled>((resolve, reject) => {
		const functionName = args[0];
		const tracing = Config.getTestVerbosity() ?? 2;
		const verbosity = !forceTrace ? `-${'v'.repeat(tracing)}` : '-vvvv';

		const wordBound = `${functionName}\\b`;
		if (processMap.has(functionName)) {
			processMap.get(functionName)?.kill();
		}
		processMap.set(
			functionName,
			cp.execFile(
				'forge',
				['test', '--mt', wordBound, verbosity, '--allow-failure'],
				{ cwd: rootPath },
				(error, stdout, stderr) => {
					const result = handleTestExecuteOutput(state, args, { stdout, error, stderr });
					processMap.delete(functionName);
					resolve(result);
				}
			)
		);
	});
}

export const handleTestExecuteOutput = (state: ClientState, args: Lens.ForgeTestExec, process: ProcessOut) => {
	try {
		const [functionName, document, range] = args;
		clearAllFoundryDiagnosticScopes(state);
		state.diagnostics.clear();

		const result = parseOutput<TestExec.Result, TestExec.Restart, TestExec.Unhandled>({
			process,
			onPass: (result) => {
				handleTestDiagnostic(state, args, result);
				const summary = result.out.summary.join('\n');
				const details = result.out.details.join('\n');
				return {
					ui: {
						statusBar: `${functionName}  🟢`,
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: 'success',
						},
					},
					...result,
				};
			},
			onFail: (result) => {
				handleTestDiagnostic(state, args, result);
				const summary = result.out.summary.join('\n');
				const details = result.out.details.join('\n');

				return {
					ui: {
						statusBar: `${functionName}  🛑`,
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: 'fail',
						},
					},
					...result,
				};
			},
			onSetupFail: (result) => {
				handleTestDiagnostic(state, args, result);
				const summary = result.out.summary.join('\n');
				const details = result.out.details.join('\n');
				return {
					ui: {
						statusBar: `${functionName} (setup)  🛑`,
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: 'fail',
						},
					},
					...result,
				};
			},
			onRestart: (result) => {
				return {
					ui: {
						statusBar: `${functionName}  🔄`,
						decoration: {
							text: 'Restarted...',
							line: range.start.line,
							scope: functionName,
							type: 'pending',
						},
					},
					...result,
				};
			},
			onCompilerError: (result, output, error) => {
				handleTestCompilerErrorDiagnostic(state, args, result, output);
				const isStackTooDeep = !!result.out.infos.stackTooDeep;
				if (isStackTooDeep) {
					return {
						ui: {
							statusBar: `${functionName}: Stack Error`,
							popup: 'Test: Compilation failed (stack too deep)',
						},
						error,
						...result,
					};
				}
				const summary = result.out.summary.join('\n');
				const details = result.out.details.join('\n');
				const errorCount = result.out.infos.errors.length;
				const addS = errorCount > 1 ? 's' : '';
				return {
					ui: {
						statusBar: `${functionName}: ${errorCount} compiler error${addS}`,
						popup: 'Test: Compilation failed.',
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: 'fail',
						},
					},
					error,
					...result,
				};
			},
			onUnhandled: (result, output, error) => {
				return {
					status: ExecStatus.Error,
					ui: {
						statusBar: `${functionName}: Unhandled 🐞`,
						popup: 'Test: Unknown error while running test.',
					},
					error,
					...result,
				};
			},
		});

		return result;
	} catch (e) {
		throw new Error(e.message);
	}
};
