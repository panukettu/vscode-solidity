import { getRootPath } from "@client/client-config"
import type { Lens } from "@client/client-types"
import { forgeOutputErrorToDiagnostic } from "@server/providers/utils/diagnostics"
import { labelRegexp, solcOutputRegexp } from "@shared/regexp"
import type { DiagnosticWithFileName } from "@shared/types"
import { Diagnostic, Position, Range } from "vscode-languageclient"
export const parseOutputLabels = (lineTexts: string[] = []) =>
	lineTexts
		.map((line, index) => {
			const trimmed = line.trim()
			if (!trimmed?.length) return null

			const match = labelRegexp().exec(trimmed)
			if (!match?.groups?.value) return null

			const { key, value } = match.groups
			if (key === "Error") {
				const isEqTest = lineTexts[index + 1].indexOf("==") !== -1 || lineTexts[index + 1].indexOf("!=") !== -1
				return {
					type: "Error",
					severity: 1,
					key: value,
					ctx: "forge",
					value: isEqTest
						? lineTexts
								.slice(index + 1, index + 4)
								.map((s) => s.trim())
								.join("\n")
						: lineTexts[index + 1],
				}
			}
			if (key.includes("Error")) return

			return {
				type: "Log",
				severity: 2,
				key,
				ctx: match.groups.ctx,
				value,
			}
		})
		.filter((label) => label?.value)

export const createDiagnosticFromLabels = (
	args: Lens.ForgeTestExec,
	offset: number,
	labels: ReturnType<typeof parseOutputLabels>,
) => {
	const [functionName, document, range] = args
	const docText = document.getText(range)
	const results = labels.map((item) => {
		const id = item.key
		if (id === "") return null

		let idLen = id.length

		const indexSingle = docText.indexOf(`'${id}`)
		const indexDouble = docText.indexOf(`"${id}`)
		const exactDouble = docText.indexOf(`"${id}"`)
		const exactSingle = docText.indexOf(`'${id}'`)
		const indexLoose = docText.indexOf(id)

		let index = Math.max(indexSingle, indexDouble)
		const ctx = item.ctx?.replace("[", "").replace("]", "")

		if (exactDouble !== -1 || exactSingle !== -1) index = Math.max(exactDouble, exactSingle)
		if (index === -1 && indexLoose !== -1) index = indexLoose
		if (index === -1) {
			if (!ctx?.length) return null

			index = docText.indexOf(`"${ctx}"`)
			if (index === -1) index = docText.indexOf(`'${ctx}'`)
			if (index === -1) return null
			idLen = ctx.length
		}

		const position = document.positionAt(offset + index + 1)
		const line = document.lineAt(position.line)
		const isErr = item.severity === 1

		const range = Range.create(
			Position.create(line.lineNumber, isErr ? line.firstNonWhitespaceCharacterIndex : position.character),
			Position.create(line.lineNumber, isErr ? line.range.end.character - 1 : position.character + idLen),
		)

		return Diagnostic.create(range, item.value, item.severity as any, ctx || (isErr ? "assert" : "log"), item.key)
	})

	return results.filter(Boolean)
}

export function parseOutputCompilerErrors(output: string): DiagnosticWithFileName[] {
	const regexp = solcOutputRegexp()
	const errors: DiagnosticWithFileName[] = []

	let match: string[] | null = null
	while ((match = regexp.exec(output)) !== null) {
		errors.push(forgeOutputErrorToDiagnostic(match, getRootPath()))
	}

	return errors
}
