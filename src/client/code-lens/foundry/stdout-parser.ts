import type { ExecFileException } from 'child_process';
import type { ParseStdOutArgs, TestExec } from '@client/types';
import { ExecStatus } from '@shared/enums';
import { formatOutput } from '@shared/regexp';
import {
	getKeywordValue,
	getLineFinder,
	getLineIndexFinder,
	getLinesFinder,
	keywords,
	toDefaultFormat,
	toLines,
} from './text/values';

export const parseOutput = <T, R = T, U = T>({
	process,
	onUnhandled,
	onPass,
	onSetupFail,
	onFail,
	onCompilerError,
	onRestart,
}: ParseStdOutArgs<T, R, U>) => {
	const { stdout, stderr, error } = process;

	const output = error ? (error.killed ? stdout : stderr) : stdout;

	const formatted = formatOutput(output);
	const lines = toLines(formatted);
	const outcome = getOutcome(lines, error);

	if (outcome.status === ExecStatus.Pass) {
		return onPass(outcome, formatted);
	} else if (outcome.status === ExecStatus.SetupFail) {
		return onSetupFail(outcome, formatted);
	} else if (outcome.status === ExecStatus.Fail) {
		return onFail(outcome, formatted);
	} else if (outcome.status === ExecStatus.Restart) {
		return onRestart(outcome, formatted);
	} else if (outcome.status === ExecStatus.CompilerError) {
		return onCompilerError(outcome, formatted, process.error);
	} else if (outcome.status === ExecStatus.Error) {
		return onUnhandled(outcome, formatted, process.error);
	}
};

export const getOutcome = (
	lines: string[],
	error?: ExecFileException
): TestExec.Result | TestExec.Restart | TestExec.Unhandled => {
	if (error?.killed) {
		return {
			status: ExecStatus.Restart,
			out: {
				lines,
			},
		};
	}
	const getIndex = getLineIndexFinder(lines);
	const getLine = getLineFinder(lines);
	const getLines = getLinesFinder(lines);

	const logStartIndex = getIndex(keywords.logs.start);
	const logEndIndex = getIndex(keywords.logs.end);
	const userLogStartIndex = getIndex(keywords.logs.lastIndexBeforeUser, true, logEndIndex) + 1;
	const errorLogIndex = getIndex(keywords.logs.lastIndexBeforeTestLogs, false, logStartIndex);

	const allLogs = lines.slice(logStartIndex + 1, logEndIndex - 1);
	const userLogs = lines.slice(userLogStartIndex, logEndIndex - 1);

	const errorLogs = errorLogIndex > logStartIndex ? lines.slice(errorLogIndex, userLogStartIndex) : [];
	const setupLogs = errorLogIndex > logStartIndex ? lines.slice(logStartIndex + 1, errorLogIndex) : [];

	const logs = {
		allLogs: allLogs,
		userLogs: userLogs.map((s) => s.trim()),
		setupLogs: setupLogs.map((s) => s.trim()),
		errorLogs,
	};
	const compileDuration = getLine(keywords.duration.compile);
	const infos = {
		gasSpent: getKeywordValue(getLine(keywords.gas.test), keywords.gas.test),
		testDuration: getKeywordValue(getLine(keywords.duration.tests), keywords.duration.tests),
		compileDuration:
			!compileDuration?.includes('Test') && !compileDuration?.includes('passed') ? compileDuration : undefined,
		compileInfo: getLine(keywords.compiler.files)?.replace('Compiling', 'Compiled'),
		stackTooDeep: getLine(keywords.compiler.details.stackTooDeep),
		errors: getLines(keywords.compiler.error),
		warnings: getLines(keywords.compiler.warnings),
	};

	const common = { lines, logs, infos };

	let result = getIndex(keywords.test.passed);
	if (result !== -1) {
		return {
			status: ExecStatus.Pass,
			out: {
				summary: [infos.testDuration, lines[result]],
				details: [' ', '-- logs', ...logs.setupLogs, ...logs.userLogs]
					.concat([' ', infos.compileInfo, infos.compileDuration])
					.filter(Boolean)
					.map(toDefaultFormat),
				...common,
			},
		};
	}

	result = getIndex(keywords.test.setupFailed);
	if (result !== -1) {
		return {
			status: ExecStatus.SetupFail,
			out: {
				summary: [infos.testDuration, lines[result]],
				details: [...getLines(keywords.test.details.setupFailed), ' ']
					.concat([...logs.errorLogs])
					.concat(['-- logs', ...logs.setupLogs, ...logs.userLogs])
					.concat([' ', infos.compileInfo, infos.compileDuration])
					.filter(Boolean)
					.map(toDefaultFormat),
				...common,
			},
		};
	}

	result = getIndex(keywords.test.failed);
	if (result !== -1) {
		return {
			status: ExecStatus.Fail,
			out: {
				summary: [infos.testDuration, lines[result]],
				details: [...logs.errorLogs]
					.concat(['-- logs', ...logs.setupLogs, ...logs.userLogs])
					.concat([' ', infos.compileInfo, infos.compileDuration])
					.filter(Boolean)
					.map(toDefaultFormat),
				...common,
			},
		};
	}

	result = getIndex(keywords.compiler.error);

	if (result !== -1) {
		return {
			status: ExecStatus.CompilerError,
			out: {
				summary: [lines[result], infos.compileInfo],
				details: [
					`${infos.errors.length} errors`,
					infos.warnings.length > 0 ? `${infos.warnings.length} warnings` : '',
				],
				...common,
			},
		};
	}
	return {
		status: ExecStatus.Error,
		out: {
			...common,
		},
	};
};
