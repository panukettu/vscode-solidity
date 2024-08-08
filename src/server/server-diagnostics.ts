import { Project } from "@shared/project/project"
import debounce from "lodash.debounce"
import type * as vscode from "vscode-languageserver/node"
import { URI } from "vscode-uri"
import { connection, documents } from "../server"
import { request } from "./handlers/requests"
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
	const project = new Project(config, settings.rootPath)
	const shouldCompile = config.validation.onChange || config.validation.onOpen || config.validation.onSave

	const uri = document.uri
	const filePath = URI.parse(uri).fsPath
	const documentText = document.getText()

	await clearExtras()

	try {
		const diagnostics = settings.linter?.validate?.(filePath, documentText) ?? []
		if (!shouldCompile) return request["diagnostics.set"]({ diagnostics: [[uri, diagnostics]] })
		const result = diagnostics.concat(await compileToDiagnostics(project, filePath, uri, documentText))
		return request["diagnostics.set"]({ diagnostics: [[uri, result], ...externals.entries()] })
	} catch (e) {
		console.debug("Unhandled:", e)
	}
}

const externals = new Map<string, vscode.Diagnostic[]>()

const clearExtras = async () => {
	await Promise.all([...externals.keys()].map((uri) => connection.sendDiagnostics({ uri, diagnostics: [] })))
	externals.clear()
}

const compileToDiagnostics = async (project: Project, filePath: string, uri: string, documentText: string) => {
	const errors = await ServerCompilers.compileWithDiagnostic(project, filePath, documentText)
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
