import type { ExecFileException } from "child_process"
import type { ParseStdOutArgs, TestExec } from "@client/client-types"
import { ExecStatus } from "@shared/enums"
import { formatOutput } from "@shared/regexp"
import logUtils, { getLineIndexFinder, getLinesFinder, keywords, toDefaultFormat, toLines } from "./logs-parser"

export const parseOutput = <T, R = T, U = T>({
	process,
	onUnhandled,
	onPass,
	onSetupFail,
	onFail,
	onCompilerError,
	onRestart,
}: ParseStdOutArgs<T, R, U>) => {
	const { stdout, stderr, error } = process

	const output = error ? (error.killed ? stdout : stderr) : stdout

	const formatted = formatOutput(output)
	const lines = toLines(formatted)
	const results = getTestResults(lines, error)

	if (results.status === ExecStatus.Pass) {
		return onPass(results, formatted)
	} else if (results.status === ExecStatus.SetupFail) {
		return onSetupFail(results, formatted)
	} else if (results.status === ExecStatus.Fail) {
		return onFail(results, formatted)
	} else if (results.status === ExecStatus.Restart) {
		return onRestart(results, formatted)
	} else if (results.status === ExecStatus.CompilerError) {
		return onCompilerError(results, formatted, process.error)
	} else if (results.status === ExecStatus.Error) {
		return onUnhandled(results, formatted, process.error)
	}
}

export const getTestResults = (
	lines: string[],
	error?: ExecFileException,
): TestExec.Result | TestExec.Restart | TestExec.Unhandled => {
	if (error?.killed) {
		return {
			status: ExecStatus.Restart,
			out: {
				lines,
			},
		}
	}
	const getIndex = getLineIndexFinder(lines)
	const getLines = getLinesFinder(lines)

	const infos = logUtils.getInfos(lines)
	const logs = logUtils.getLogs(lines)
	const traces = logUtils.getTraces(lines)

	const common = { lines, logs, infos, traces }

	const summary = (idx: number) => [lines[idx], infos.testDuration, " "]
	const details = (pre: string[] = []) =>
		pre
			.concat(logs.formatted)
			.concat([traces.summaryText, " ", infos.compileInfo, infos.compileDuration])
			.filter(Boolean)
			.map(toDefaultFormat)

	let result = getIndex(keywords.test.passed)
	if (result !== -1) {
		return {
			status: ExecStatus.Pass,
			out: {
				summary: summary(result),
				details: details(),
				...common,
			},
		}
	}

	result = getIndex(keywords.test.setupFailed)
	if (result !== -1) {
		return {
			status: ExecStatus.SetupFail,
			out: {
				summary: summary(result),
				details: details([...getLines(keywords.test.details.setupFailed), " "]),
				...common,
			},
		}
	}

	result = getIndex(keywords.test.failed)
	if (result !== -1) {
		return {
			status: ExecStatus.Fail,
			out: {
				summary: summary(result),
				details: details(),
				...common,
			},
		}
	}

	result = getIndex(keywords.compiler.error)
	if (result !== -1) {
		return {
			status: ExecStatus.CompilerError,
			out: {
				summary: [lines[result], " ", infos.compileInfo],
				details: [
					`${infos.errors.length} errors`,
					infos.warnings.length > 0 ? `${infos.warnings.length} warnings` : "",
					"check 'Problems' tab for more details",
				],
				...common,
			},
		}
	}
	return {
		status: ExecStatus.Error,
		out: {
			...common,
		},
	}
}
