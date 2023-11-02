import { getCurrentProjectInWorkspaceRootFsPath } from "@client/client-config"
import type { ClientState } from "@client/client-state"
import type { Lens, TestExec } from "@client/client-types"
import { forgeOutputErrorToDiagnostic } from "@server/providers/utils/diagnostics"
import { solcOutputRegexp } from "@shared/regexp"
import type { DiagnosticWithFileName } from "@shared/types"
import { Diagnostic, Position, Range } from "vscode-languageclient/node"

export const parseOutputLabels = (lineTexts: string[] = []) =>
	lineTexts
		.map((line, index) => {
			const trimmed = line.trim()
			let split = trimmed
				.split(":")
				.map((s) => s.trim())
				.filter(Boolean)

			if (split.length < 2) {
				split = trimmed
					.split(" ")
					.map((s) => s.trim())
					.filter(Boolean)
				if (split.length < 2) {
					return null
				}
			}
			if (split[0] === "Error") {
				const isEqTest = lineTexts[index + 1].indexOf("==") !== -1 || lineTexts[index + 1].indexOf("!=") !== -1
				return {
					type: "Error",
					severity: 1,
					key: split[1],
					value: isEqTest
						? lineTexts
								.slice(index + 1, index + 4)
								.map((s) => s.trim())
								.join("\n")
						: lineTexts[index + 1],
				}
			} else {
				return {
					type: "Log",
					severity: 2,
					key: split[0],
					value: split.map((s) => s.trim()).join("\n"),
				}
			}
		})
		.filter(Boolean)

export function parseOutputCompilerErrors(
	state: ClientState,
	args: Lens.ForgeTestExec,
	parsed: TestExec.Result,
	output: string,
): DiagnosticWithFileName[] {
	const regexp = solcOutputRegexp()
	const errors: DiagnosticWithFileName[] = []

	let match: string[] | null = null
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = regexp.exec(output)) !== null) {
		errors.push(forgeOutputErrorToDiagnostic(match, getCurrentProjectInWorkspaceRootFsPath()))
	}

	return errors
}

export const parsedLabelsToDiagnostics = (
	args: Lens.ForgeTestExec,
	offset: number,
	parsedOutput: ReturnType<typeof parseOutputLabels>,
) => {
	const [functionName, document, range] = args
	const docText = document.getText(range)
	const results = parsedOutput.map((item) => {
		const id = item.key
		if (id === "") return null

		const indexSingle = docText.indexOf(`'${id}`)
		const indexDouble = docText.indexOf(`"${id}`)
		const exactDouble = docText.indexOf(`"${id}"`)
		const exactSingle = docText.indexOf(`'${id}'`)
		const indexLoose = docText.indexOf(id)

		let index = Math.max(indexSingle, indexDouble)

		if (exactDouble !== -1 || exactSingle !== -1) index = Math.max(exactDouble, exactSingle)
		if (indexLoose !== -1 && index === -1) index = indexLoose
		if (index === -1) return null

		const position = document.positionAt(offset + index)
		const line = document.lineAt(position.line)
		const diagnostic = Diagnostic.create(
			// document.getWordRangeAtPosition(position),
			Range.create(Position.create(line.lineNumber, line.firstNonWhitespaceCharacterIndex), line.range.end),
			`${item.value}`,
			item.severity as any,
			item.severity === 0 ? "assert" : "log",
			"vsc-solidity",
		)
		diagnostic.source = `${functionName}: ${id}`

		return diagnostic
	})

	return results.filter(Boolean)
}
