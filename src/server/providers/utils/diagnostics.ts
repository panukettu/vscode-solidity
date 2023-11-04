// import { settings } from '@server/settings';
import type { SolcError } from "@shared/compiler/types-solc"
import { solcOutputRegexp } from "@shared/regexp"
import { DiagnosticWithFileName } from "@shared/types"
import {
	Diagnostic,
	DiagnosticRelatedInformation,
	DiagnosticSeverity,
	Position,
	Range,
} from "vscode-languageserver/node"

export function getDiagnosticSeverity(severity: string): DiagnosticSeverity {
	switch (severity) {
		case "error":
			return DiagnosticSeverity.Error
		case "warning":
			return DiagnosticSeverity.Warning
		case "info":
			return DiagnosticSeverity.Information
		default:
			return DiagnosticSeverity.Error
	}
}

export function errorToDiagnostic(error: SolcError) {
	if (error.sourceLocation.file != null) {
		const fileName = error.sourceLocation.file

		const errorSplit = error.formattedMessage.substr(error.formattedMessage.indexOf(fileName)).split(":")
		let index = 1
		// a full path in windows includes a : for the drive
		if (process.platform === "win32") {
			index = 2
		}

		return splitErrorToDiagnostic(error, errorSplit, index, fileName)
	} else {
		const errorSplit = error.formattedMessage.split(":")
		let fileName = errorSplit[0]
		let index = 1

		// a full path in windows includes a : for the drive
		if (process.platform === "win32") {
			fileName = `${errorSplit[0]}:${errorSplit[1]}`
			index = 2
		}

		return splitErrorToDiagnostic(error, errorSplit, index, fileName)
	}
}

export function splitErrorToDiagnostic(error: SolcError, errorSplit: any, index: number, fileName: any) {
	const severity = getDiagnosticSeverity(error.severity)
	const errorMessage = error.message
	// tslint:disable-next-line:radix
	let line = parseInt(errorSplit[index])
	if (Number.isNaN(line)) {
		line = 1
	}
	// tslint:disable-next-line:radix
	let column = parseInt(errorSplit[index + 1])
	if (Number.isNaN(column)) {
		column = 1
	}

	let startCharacter = column - 1

	let endCharacter = column + error.sourceLocation.end - error.sourceLocation.start - 1
	if (endCharacter < 0) {
		endCharacter = 1
	}

	let endLine = line - 1
	let startLine = line - 1

	if (error.errorCode === "1878") {
		startLine = 0
		endLine = 2
		endCharacter = 0
		startCharacter = 1
	}
	const range = Range.create(startLine, startCharacter, endLine, endCharacter)
	const diagnostic: Diagnostic = {
		message: errorMessage,
		source: "solc",
		code: error.errorCode,
		range: range,
		severity: severity,
	}

	if (error.secondarySourceLocations?.length) {
		const [relatedInfos] = mapSecondarySourceToVscode(error, {
			diagnostic,
			fileName,
		})
		diagnostic.relatedInformation = relatedInfos
		return {
			diagnostic,
			fileName,
			extraDiagnostics: [],
		}
	}
	return {
		diagnostic,
		fileName,
	}
}

export function forgeOutputErrorToDiagnostic(match: string[], rootPath: string): DiagnosticWithFileName {
	let [, type, , errorCode, message, fileName, matchLine, character, code] = match
	if (!message && !fileName) {
		type = match[9]
		errorCode = match[10]
		message = match[11]
		fileName = match[12]
		matchLine = match[13]
		character = match[14]
	}

	const trimmedCode = code ? code.trim() : ""

	const start = Position.create(parseInt(matchLine) - 1, parseInt(character) - 1)
	const end = Position.create(start.line, start.character)

	const typeLower = type.toLowerCase().trim()

	const diagnostic: Diagnostic = {
		message: message.trim(),
		code: errorCode ? (Number.isNaN(Number(errorCode)) ? "stack-too-deep" : errorCode.trim()) : undefined,
		range: Range.create(start, end),
		source: "solc",
		severity: (typeLower === "error" ? 0 : typeLower === "warning" ? 1 : 2) as DiagnosticSeverity,
	}

	if (message.toLowerCase().includes("missing implementation")) {
		diagnostic.message = diagnostic.message + (code ? code.trim() : "")
	}
	return {
		diagnostic,
		fileName: `${rootPath}/${fileName}`,
	}
}

const mapSecondarySourceToVscode = (error: SolcError, parent?: DiagnosticWithFileName) => {
	const regexp = solcOutputRegexp()
	const results: DiagnosticRelatedInformation[] = []
	const diagnostics: DiagnosticWithFileName[] = []

	let match: string[] | null = null

	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((match = regexp.exec(error.formattedMessage)) !== null) {
		let [, type, , errorCode, message, fileName, matchLine, character, code] = match
		if (!message && !fileName) {
			type = match[9]
			errorCode = match[10]
			message = match[11]
			fileName = match[12]
			matchLine = match[13]
			character = match[14]
		}
		const trimmed = code ? code.trim() : ""
		const range = Range.create(
			Position.create(parseInt(matchLine) - 1, parseInt(character)),
			Position.create(parseInt(matchLine) - 1, parseInt(character)),
		)
		results.push({
			location: {
				range: range,
				uri: fileName,
			},
			message: message + trimmed,
		})
		const diagnostic: Diagnostic = {
			message: message + trimmed,
			source: "solc",
			code: error.errorCode ?? errorCode,
			range: range,
			severity: DiagnosticSeverity.Error,
		}
		if (parent) {
			diagnostic.relatedInformation = [
				{
					location: {
						range: parent.diagnostic.range,
						uri: parent.fileName,
					},
					message: message + trimmed,
				},
			]
		}
		diagnostics.push({ diagnostic, fileName })
	}

	return [results, diagnostics] as const
}
