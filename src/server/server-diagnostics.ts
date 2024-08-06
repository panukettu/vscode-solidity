import debounce from "lodash.debounce"
import type * as vscode from "vscode-languageserver/node"
import { URI } from "vscode-uri"
import { connection, documents } from "../server"
import { ServerCompilers } from "./server-compiler"
import { getConfig, settings } from "./server-config"
import { initCommon } from "./server-utils"

export let validatingAllDocuments = false

const versionMap = new Map<string, number>()

const validateDebounced = debounce(validate, getConfig().validation.delay, {
	leading: false,
	trailing: true,
})

export async function validateDocument(document: vscode.TextDocument) {
	if (versionMap.get(document.uri) === document.version) return

	versionMap.set(document.uri, document.version)
	await validateDebounced(document)
}

export async function validateAllDocuments() {
	if (validatingAllDocuments) return

	validatingAllDocuments = true
	return await Promise.all(documents.all().map(validateDebounced))
		.then(() => {
			validatingAllDocuments = false
		})
		.catch((err) => {
			console.debug("Error validating all documents", err)
			validatingAllDocuments = false
		})
}

export async function validate(document: vscode.TextDocument) {
	initCommon(document)
	const config = getConfig()
	const shouldCompile = config.validation.onChange || config.validation.onOpen || config.validation.onSave

	const uri = document.uri
	const filePath = URI.parse(uri).fsPath
	const documentText = document.getText()

	await clearExtras()

	try {
		const linted = settings.linter?.validate?.(filePath, documentText) ?? []
		if (!shouldCompile) return sendDiagnostics(uri, linted)

		return sendDiagnostics(uri, linted.concat(await getErrors(filePath, uri, documentText)))
	} catch (e) {
		console.debug("Unhandled:", e)
	}
}

const externals = new Map<string, vscode.Diagnostic[]>()

const clearExtras = async () => {
	await Promise.all([...externals.keys()].map((uri) => connection.sendDiagnostics({ uri, diagnostics: [] })))
	externals.clear()
}

const sendDiagnostics = async (uri: string, diagnostics: vscode.Diagnostic[]) => {
	return Promise.all(
		[connection.sendDiagnostics({ uri, diagnostics })].concat(
			[...externals.entries()].map(([extURI, extras]) =>
				connection.sendDiagnostics({ uri: extURI, diagnostics: extras }),
			),
		),
	)
}
const getErrors = async (filePath: string, uri: string, documentText: string) => {
	const errors = await ServerCompilers.compileWithDiagnostic(filePath, documentText)
	const diagnostics = errors.filter((err) => URI.file(err.fileName).toString() === uri)

	const fromOtherFiles = errors
		.flatMap((err) => err.extraDiagnostics)
		.filter((err) => {
			if (!err?.fileName || !err.diagnostic) return false

			const extraURI = URI.file(err.fileName).toString()
			if (extraURI === uri) return true

			const prev = externals.get(extraURI) ?? []
			externals.set(extraURI, prev.concat(err.diagnostic))
		})

	return diagnostics.concat(fromOtherFiles).map((err) => err.diagnostic)
}
