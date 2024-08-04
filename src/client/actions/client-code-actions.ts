import * as vscode from "vscode"
type ActionDefinition = {
	code: string
	kinds: vscode.CodeActionKind[]
	regex?: () => RegExp
	data?: any
	createFix: (
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
		range: vscode.Range,
		data?: any,
	) => vscode.CodeAction[]
}

const checksum: ActionDefinition = {
	code: "9429",
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	data: [],
	regex: () => new RegExp(/Correct checksummed address: "0x(?<address>[0-9a-fA-F]*)"/, "gm"),
	createFix: (
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
		range: vscode.Range,
	): vscode.CodeAction[] => {
		const match = checksum.regex().exec(diagnostic.message)
		if (!match?.groups.address) return null
		const fixedAddress = match.groups.address
		const fix = new vscode.CodeAction(
			`Convert address to checksummed address: 0x${fixedAddress}`,
			vscode.CodeActionKind.QuickFix,
		)
		const line = document.lineAt(diagnostic.range.start.line)
		fix.edit = new vscode.WorkspaceEdit()
		fix.edit.replace(
			document.uri,
			new vscode.Range(diagnostic.range.start, diagnostic.range.start.translate(0, fixedAddress.length + 2)),
			`0x${fixedAddress}`,
		)
		fix.isPreferred = true
		fix.diagnostics = [diagnostic]
		return [fix]
	},
}

// const variableName: ActionDefinition = {
// 	code: "7576",
// 	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
// 	regex: () => new RegExp(/Did you mean "(?<variable>.*?)"((?=\s?)?.*?"(?<second>.*?)")?/, "gm"),
// 	createFix: (
// 		document: vscode.TextDocument,
// 		diagnostic: vscode.Diagnostic,
// 		range: vscode.Range,
// 	): vscode.CodeAction[] => {
// 		const match = variableName.regex().exec(diagnostic.message)
// 		if (match) {
// 			if (match.groups.variable) {
// 				const result: vscode.CodeAction[] = []
// 				const convertedRange = new vscode.Range(
// 					diagnostic.range.start.line,
// 					diagnostic.range.start.character,
// 					diagnostic.range.end.line,
// 					diagnostic.range.end.character,
// 				)
// 				const variable = match.groups.variable
// 				const fix = new vscode.CodeAction(`Change to: ${variable}`, vscode.CodeActionKind.QuickFix)
// 				const wordRange = document.getWordRangeAtPosition(convertedRange.start)
// 				const line = document.lineAt(convertedRange.start.line)
// 				fix.edit = new vscode.WorkspaceEdit()
// 				fix.edit.replace(document.uri, wordRange, `${variable}`)

// 				fix.diagnostics = [{ ...diagnostic, range: line.range }]
// 				if (match.groups.second) {
// 					const second = match.groups.second
// 					const fix2 = new vscode.CodeAction(`Change to: ${second}`, vscode.CodeActionKind.QuickFix)
// 					fix2.edit = new vscode.WorkspaceEdit()
// 					fix2.diagnostics = fix.diagnostics
// 					fix2.edit.replace(document.uri, wordRange, `${second}`)
// 					fix2.isPreferred = line.range.contains(range.start)
// 					result.push(fix2)
// 				} else {
// 					fix.isPreferred = line.range.contains(range.start)
// 				}
// 				result.push(fix)
// 				return result
// 			}
// 		}
// 		return null
// 	},
// }

const compilerVersion = {
	code: "5333",
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	createFix: (document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] => {
		const fix = new vscode.CodeAction("Change workspace compiler version", vscode.CodeActionKind.QuickFix)

		fix.command = {
			command: "solidity.selectWorkspaceRemoteSolcVersion",
			title: "Change the workspace remote compiler version",
			tooltip: "This will open a prompt with the solidity version",
		}
		fix.diagnostics = [diagnostic]
		return [fix]
	},
}

const spdx = {
	code: "1878",
	kinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Empty],
	data: {
		licenses: ["MIT", "AGPL-3.0-or-later", "GPL-3.0-or-later", "BUSL-1.1", "UNKNOWN", "UNLICENSED"],
		preferredLicense: "MIT",
	},
	createFix: (
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
		range: vscode.Range,
	): vscode.CodeAction[] => {
		return spdx.data.licenses.map((license) => {
			const isPreferred = license === spdx.data.preferredLicense
			const fix = new vscode.CodeAction(`Add SPDX License ${license}`, vscode.CodeActionKind.QuickFix)
			const licenseText = `// SPDX-License-Identifier: ${license}`
			fix.edit = new vscode.WorkspaceEdit()
			const line = document.lineAt(range.start.line)
			const shouldReplace = line.text.trim().includes("//")
			shouldReplace
				? fix.edit.replace(document.uri, line.range, licenseText)
				: fix.edit.insert(document.uri, range.start, `${licenseText}\n`)
			fix.isPreferred = isPreferred

			fix.diagnostics = [diagnostic]
			fix.diagnostics[0].range = line.range
			return fix
		})
	},
}
const actions = [checksum, compilerVersion, spdx] as const

/* -------------------------------------------------------------------------- */
/*                                     New                                    */
/* -------------------------------------------------------------------------- */

export class CodeActionsProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix,
		vscode.CodeActionKind.Empty,
	] as const

	public static createFix(
		document: vscode.TextDocument,
		diagnostic: vscode.Diagnostic,
		data?: any,
	): vscode.CodeAction[] {
		const action = actions.find((a) => a.code === diagnostic.code)
		if (action) return action.createFix(document, diagnostic, data)
		return null
	}

	// tslint:disable-next-line:max-line-length
	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken,
	): vscode.CodeAction[] {
		const allDiagnostics = context.diagnostics.concat(
			vscode.languages
				.getDiagnostics()
				.filter((d) => d[1]?.length > 0)
				.flatMap((d) => d[1]),
		)
		// for each diagnostic entry that has the matching `code`, create a code action command
		try {
			const onlyUnique = allDiagnostics.filter((v, i, a) => a.findIndex((t) => t.message === v.message) === i)

			return onlyUnique
				.filter((diagnostic) => actions.find((a) => a.code === diagnostic.code))
				.flatMap((diagnostic) => CodeActionsProvider.createFix(document, diagnostic, range))
		} catch (e) {}
	}
}
