import type { ClientState } from "@client/client-state"
import { Lens } from "@client/client-types"
import { execForgeTestFunction } from "@client/lens/foundry/executors/test-executor"
import { createStatusBar, createStatusBarTest } from "@client/ui/statusbar"
import { ExecStatus } from "@shared/enums"
import * as vscode from "vscode"
import { initDecorations } from "../ui/decorations"

export const commandTestInfo = (state: ClientState) => async (...args: Lens.ForgeTestExec) => {
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
				state.compilers.outputChannel.appendLine(`Total contracts deployed during ${functionName}():`)
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
