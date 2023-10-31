import * as cp from 'child_process';
import { ClientState } from '@client/client-state';
import type { TestFunctionLensArgs, TestFunctionResult } from '@shared/types';
import { handleTestResult } from './helpers';

const processMap = new Map<string, cp.ChildProcess>();

export function execForgeTestFunction(
	state: ClientState,
	args: TestFunctionLensArgs,
	rootPath: string
): Promise<TestFunctionResult> {
	return new Promise((resolve, reject) => {
		const functionName = args[0];

		const wordBound = `${functionName}\\b`;
		if (processMap.has(functionName)) {
			processMap.get(functionName)?.kill();
		}
		processMap.set(
			functionName,
			cp.execFile('forge', ['test', '--mt', wordBound, '-vv'], { cwd: rootPath }, (err, stdout) => {
				const result = handleTestResult(state, args, stdout, err);
				processMap.delete(functionName);
				return resolve(result);
			})
		);
	});
}
