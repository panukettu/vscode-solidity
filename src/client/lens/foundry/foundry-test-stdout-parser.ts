import type { ExecFileException } from "node:child_process"
import type { ParseStdOutArgs, TestExec } from "@client/client-types"
import { clearDiagnostics } from "@client/commands/diagnostics"
import { ExecStatus } from "@shared/enums"
import { formatOutput } from "@shared/regexp"
import logUtils, { getLineIndexFinder, getLinesFinder, keywords, toDefaultFormat, toLines } from "./foundry-logs-parser"
const CONSOLE_LOG_ADDR = "0x000000000000000000636F6e736F6c652e6c6f67"
const VM_ADDR = "0x7109709ECfa91a80626fF3989D68f67F5b1DD12D"
const DEPLOYER_NONCE_1 = "0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496"
// address constant fSender = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;
export const parseTestOutput = <T, R = T, U = T>({
	process,
	args,
	onUnhandled,
	onPass,
	onSetupFail,
	onFail,
	onCompilerError,
	onRestart,
}: ParseStdOutArgs<T, R, U>) => {
	try {
		const { stdout, stderr, error } = process
		const [id] = args

		const output = !!error && !error?.message?.includes("Compilation") && !error?.killed ? stderr : stdout

		const formatted = formatOutput(output)
		const lines = toLines(formatted)

		const results = getTestResults(lines, id, process.error)

		results.status !== ExecStatus.Error && clearDiagnostics({ keepDecor: true, doc: args[1] })

		if (results.status === ExecStatus.Pass) {
			return onPass(results, formatted)
		}
		if (results.status === ExecStatus.SetupFail) {
			return onSetupFail(results, formatted)
		}
		if (results.status === ExecStatus.Fail) {
			return onFail(results, formatted)
		}
		if (results.status === ExecStatus.CompilerError) {
			return onCompilerError(results, formatted, process.error)
		}
		if (results.status === ExecStatus.Restart) return onRestart(results, formatted)

		if (results.status === ExecStatus.Error) return onUnhandled(results, formatted, process.error)
	} catch (e) {
		console.debug("parseTestOutput fail:", e)
	}
}

export const getTestResults = (
	lines: string[],
	id: string,
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
	try {
		const infos = logUtils.getInfos(lines, id)
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
	} catch (e) {
		console.debug("test-results fail:", e.message)
	}
}
