import { Config } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import type { CommandInfo, Lens } from "@client/client-types"
import { execForgeTestFunction } from "@client/lens/foundry/executors/test-executor"
import {
	initDecorations,
	lineDecoration,
	removeAllDecorations,
	resetDecorations,
	runDecorated,
} from "@client/ui/decorations"
import { clearAllStatusBars, createStatusBar, createStatusBarTest } from "@client/ui/statusbar"
import { ExecStatus } from "@shared/enums"
import * as vscode from "vscode"
import { CLIENT_COMMAND_LIST } from "./commands-list"

export const commandExecTest =
	(state: ClientState) =>
	async (...args: Lens.ForgeTestExec) => {
		const isTracing = Config.getTestVerbosity() > 2
		const [functionName, document] = args
		if (!args.length) return
		const line = args[2].start.line
		clearAllStatusBars()
		removeAllDecorations(state)

		initDecorations(state, functionName)
		const statusBar = createStatusBarTest(functionName, `${functionName}  🟡`)

		/* ------------------------------------------------------------------------- */
		/*                                    run                                    */
		/* ------------------------------------------------------------------------- */
		const results = await runDecorated(
			document,
			state,
			{
				promise: execForgeTestFunction(state, args, vscode.workspace.rootPath),
				scope: functionName,
				line,
			},
			"Test running",
		)

		/* ------------------------------------------------------------------------- */
		/*                                  results                                  */
		/* ------------------------------------------------------------------------- */

		resetDecorations(state, functionName, ["success", "fail"])

		if (results.ui.statusBar) {
			statusBar.text = results.ui.statusBar
		}

		if (results.ui.decoration) {
			lineDecoration(
				state,
				results.ui.decoration,
				document,
				document.uri.fsPath !== vscode.window.activeTextEditor.document.uri.fsPath,
			)
		}

		const tooltip = (contracts: number, events: number, calls: number) =>
			`contracts/events/calls\n${contracts}/${events}/${calls}`

		/* --------------------------------- pass --------------------------------- */
		if (results.status === ExecStatus.Pass) {
			results.ui.popup && vscode.window.showInformationMessage(results.ui.popup)
			if (isTracing && results.out.traces.contracts.length) {
				statusBar.tooltip = tooltip(
					results.out.traces.contracts.length,
					results.out.traces.events.length,
					results.out.traces.calls.user.length,
				)
			}
			return
		}

		/* ------------------------------- setup fail ------------------------------ */
		if (results.status === ExecStatus.SetupFail) {
			results.ui.popup && vscode.window.showWarningMessage(results.ui.popup)
			if (isTracing && results.out.traces.contracts.length) {
				statusBar.tooltip = tooltip(
					results.out.traces.contracts.length,
					results.out.traces.events.length,
					results.out.traces.calls.user.length,
				)
			}
			return
		}

		/* ---------------------------------- fail --------------------------------- */
		if (results.status === ExecStatus.Fail) {
			results.ui.popup && vscode.window.showWarningMessage(results.ui.popup)
			if (isTracing && results.out.traces.contracts.length) {
				statusBar.tooltip = tooltip(
					results.out.traces.contracts.length,
					results.out.traces.events.length,
					results.out.traces.calls.user.length,
				)
			}
			return
		}
		/* ----------------------------- errors/restart ---------------------------- */
		if (results.status === ExecStatus.Restart) {
			results.ui.popup && vscode.window.showInformationMessage(results.ui.popup)
			return
		}

		if (results.status === ExecStatus.CompilerError) {
			results.ui.popup && vscode.window.showErrorMessage(results.ui.popup)
			return
		}

		if (results.status === ExecStatus.Error) {
			results.ui.popup && vscode.window.showErrorMessage(results.ui.popup)
			return
		}
	}

const commandTestInfo =
	(state: ClientState) =>
	async (...args: Lens.ForgeTestExec) => {
		const functionName = args[0]
		const statusBar = createStatusBar(args[0], "Preparing data.. 🟡")
		initDecorations(state, functionName)

		state.compilers.outputChannel.clear()
		state.compilers.outputChannel.show()
		state.compilers.outputChannel.appendLine("*** Preparing data..")

		try {
			const results = await execForgeTestFunction(state, args, vscode.workspace.rootPath, true)

			if (results.status === ExecStatus.Pass || results.status === ExecStatus.Fail) {
				statusBar.text = "Printing... 🟢"
				state.compilers.outputChannel.appendLine(`*** Printing data for ${functionName}()`)

				const contractCount = results.out.traces.contracts?.length
				const eventCount = results.out.traces.events?.length
				const callCount = results.out.traces.calls.user?.length
				const vmCallCount = results.out.traces.calls.vm?.length

				if (!contractCount) {
					state.compilers.outputChannel.appendLine(`No contracts deployed during ${functionName}().`)
				} else {
					state.compilers.outputChannel.appendLine(JSON.stringify(results.out.traces.contracts, null, 2))
					state.compilers.outputChannel.appendLine(
						`Total contracts deployed during ${functionName}(): ${contractCount}`,
					)
					try {
						state.compilers.outputChannel.appendLine(
							`Total size of contracts in bytes: ${results.out.traces.contracts.reduce((a, b) => {
								return a + Number(b.size.replace(/\D/g, ""))
							}, 0)} bytes`,
						)
						const smallest = results.out.traces.contracts.reduce((a, b) => {
							return Number(a.size.replace(/\D/g, "")) < Number(b.size.replace(/\D/g, "")) ? a : b
						})
						const bigggest = results.out.traces.contracts.reduce((a, b) => {
							return Number(a.size.replace(/\D/g, "")) > Number(b.size.replace(/\D/g, "")) ? a : b
						})
						state.compilers.outputChannel.appendLine(`- Smallest contract: ${smallest.name} (${smallest.size})`)
						state.compilers.outputChannel.appendLine(`- Biggest contract: ${bigggest.name} (${bigggest.size})`)
					} catch (e) {
						console.debug(e)
						state.compilers.outputChannel.appendLine("*** Could not calculate total size of contracts.")
					}
				}

				if (!eventCount) {
					state.compilers.outputChannel.appendLine(`No events emitted during ${functionName}().`)
				} else {
					state.compilers.outputChannel.appendLine(`Total events emitted during ${functionName}(): ${eventCount}`)
				}

				if (!results.out.traces.calls.user?.length) {
					state.compilers.outputChannel.appendLine(`No calls made in ${functionName}().`)
				} else {
					state.compilers.outputChannel.appendLine(`Total calls made during ${functionName}(): ${callCount}`)
				}

				if (!results.out.traces.calls.vm?.length) {
					state.compilers.outputChannel.appendLine(`No VM calls made in ${functionName}().`)
				} else {
					state.compilers.outputChannel.appendLine(`Total VM calls made during ${functionName}(): ${vmCallCount}`)
				}

				state.compilers.outputChannel.appendLine("*** Finished! Use 'solidity.lens.function.test' to run the function")
				state.compilers.outputChannel.appendLine(`*** Took ${results.out.infos.testDuration} to complete.`)
				statusBar.text = `📑  ${contractCount}  |  📡 ${eventCount}  |  📳 ${callCount}`
				statusBar.tooltip = "Contracts | Events | Calls"
			}
		} catch (e) {
			state.compilers.outputChannel.appendLine(`*** Could not print data. Error: ${e.message}`)
		}
	}

export default (state: ClientState): CommandInfo[] => [
	[CLIENT_COMMAND_LIST["solidity.lens.function.test"], commandExecTest(state)],
	[CLIENT_COMMAND_LIST["solidity.lens.function.test.info"], commandTestInfo(state)],
]
