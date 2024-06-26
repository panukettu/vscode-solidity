import * as cp from "child_process"
import { Config } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import type { Lens, ProcessOut, TestExec } from "@client/client-types"
import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
import { gasCache } from "@client/utils/gas"
import { ExecStatus } from "@shared/enums"
import * as vscode from "vscode"
import { createCompilerDiagnostics, createTestDiagnostics } from "../diagnostics/foundry-diagnostics"
import { parseTestOutput } from "../foundry-test-stdout-parser"

const processMap = new Map<string, cp.ChildProcess>()

export async function execForgeTestFunction(
	state: ClientState,
	args: Lens.ForgeTestExec,
	rootPath: string,
	forceTrace = false,
) {
	return new Promise<TestExec.Result | TestExec.Restart | TestExec.Unhandled>((resolve, reject) => {
		try {
			const functionName = args[0]
			const tracing = Config.getTestVerbosity() ?? 2
			const verbosity = !forceTrace ? `-${"v".repeat(tracing)}` : "-vvvvv"

			const wordBound = `${functionName}\\b`
			if (processMap.has(functionName)) {
				processMap.get(functionName)?.kill()
			}

			processMap.set(
				functionName,
				cp.execFile(
					"forge",
					["test", "--mt", wordBound, verbosity, "--allow-failure"],
					{ cwd: rootPath, maxBuffer: 2048 * 1024 * 10 },
					(error, stdout, stderr) => {
						vscode.commands.executeCommand(CLIENT_COMMAND_LIST["solidity.diagnostics.clear"], true, args[1])
						const result = handleTestExecuteOutput(state, args, {
							stdout,
							error,
							stderr,
						})
						resolve(result)
						processMap.delete(functionName)
					},
				),
			)
		} catch (e) {
			console.debug("ExecForgeTest", e.message)
			reject(e)
			processMap.clear()
		}
	})
}

export const handleTestExecuteOutput = (state: ClientState, args: Lens.ForgeTestExec, process: ProcessOut) => {
	try {
		const [functionName, document, range] = args

		return parseTestOutput<TestExec.Result, TestExec.Restart, TestExec.Unhandled>({
			process,
			args,
			onPass: (result) => {
				createTestDiagnostics(state, args, result)

				const summary = [
					`Pass (${result.out.infos.testDuration})`,
					gasCache.save(functionName, result.out.infos.gasSpent).summary,
					" ",
				].join("\n")
				const details = result.out.details.join("\n")
				return {
					ui: {
						statusBar: `${functionName}  🟢`,
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: "success",
						},
					},
					...result,
				}
			},
			onFail: (result) => {
				createTestDiagnostics(state, args, result)
				const summary = [
					`Fail: ${result.out.infos.reason} (${result.out.infos.testDuration})`,
					gasCache.save(functionName, result.out.infos.gasSpent).summary,
					" ",
				].join("\n")
				const details = result.out.details.join("\n")
				return {
					ui: {
						statusBar: `${functionName}  🛑`,
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: "fail",
						},
					},
					...result,
				}
			},
			onSetupFail: (result) => {
				createTestDiagnostics(state, args, result)
				const summary = [`${result.out.infos.reason} (${result.out.infos.testDuration})`, " "].join("\n")
				const details = result.out.details.join("\n")
				return {
					ui: {
						statusBar: `${functionName} (setup)  🛑`,
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: "fail",
						},
					},
					...result,
				}
			},
			onRestart: (result) => {
				return {
					ui: {
						statusBar: `${functionName}  🔄`,
						decoration: {
							text: "Restarted...",
							line: range.start.line,
							scope: functionName,
							type: "pending",
						},
					},
					...result,
				}
			},
			onCompilerError: (result, output, error) => {
				createCompilerDiagnostics(state, args, result, output)
				const isStackTooDeep = !!result.out.infos.stackTooDeep
				if (isStackTooDeep) {
					return {
						ui: {
							statusBar: `${functionName}: Stack Error`,
							popup: "Test: Compilation failed (stack too deep)",
						},
						error,
						...result,
					}
				}
				const summary = result.out.summary.join("\n")
				const details = result.out.details.join("\n")
				const errorCount = result.out.infos.errors.length
				const S = errorCount > 1 ? "s" : ""
				return {
					ui: {
						statusBar: `${functionName}: ${errorCount} compiler error${S}`,
						popup: "Test: Compilation failed.",
						decoration: {
							text: `${summary}\n${details}`,
							line: range.start.line,
							scope: functionName,
							type: "fail",
						},
					},
					error,
					...result,
				}
			},
			onUnhandled: (result, output, error) => {
				console.debug("Unhandled", error.message)
				return {
					status: ExecStatus.Error,
					ui: {
						statusBar: `${functionName}: Unhandled error 🐞`,
						popup: "Test: Error during execution.",
					},
					error,
					...result,
				}
			},
		})
	} catch (e) {
		throw new Error(e.message)
	}
}
