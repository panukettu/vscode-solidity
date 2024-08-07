import { URI } from "vscode-uri"
import { findFirstRootProjectFile } from "../shared/project/project-utils"
import { CodeWalkerService } from "./codewalker"
import { ServerCompilers } from "./server-compiler"
import { getConfig, settings } from "./server-config"

export let selectedDocument = null
export let selectedProjectFolder = null

let walker: CodeWalkerService = null

export function initCommon(document: any) {
	if (typeof document.uri === "string") {
		initWorkspaceRootFolder(document.uri)
		return initCurrentProjectInWorkspaceRootFsPath(document.uri)
	}

	if (typeof document.uri === "object") {
		initWorkspaceRootFolder(document.uri.external)
		return initCurrentProjectInWorkspaceRootFsPath(document.uri.external)
	}
}

export function getCodeWalkerService() {
	const config = getConfig()
	if (walker?.rootPath && walker.rootPath === walker.project.rootPath) {
		return walker
	}

	return (walker = new CodeWalkerService(selectedProjectFolder, config))
}

export function initWorkspaceRootFolder(uri: string) {
	if (!ServerCompilers) throw new Error("1ServerCompilers not initialized")
	if (!settings) throw new Error("1settings not initialized")

	if (settings.rootPath) return

	const fullUri = URI.parse(uri)
	if (!settings.workspaceFolders || fullUri.fsPath.startsWith(settings.rootPath)) return

	const newRootFolder = settings.workspaceFolders.find((x) => uri.startsWith(x.uri))
	if (newRootFolder == null) return

	settings.rootPath = URI.parse(newRootFolder.uri).fsPath
	ServerCompilers.rootPath = settings.rootPath
	if (settings.linter) settings.linter.loadFileConfig(settings.rootPath)
}

export function initCurrentProjectInWorkspaceRootFsPath(currentDocument: string) {
	if (!ServerCompilers) throw new Error("2ServerCompilers not initialized")
	if (!settings) throw new Error("2settings not initialized")

	const config = getConfig()

	if (!config.project.monorepo) {
		ServerCompilers.rootPath = settings.rootPath
		selectedDocument = currentDocument
		return (selectedProjectFolder = settings.rootPath)
	}

	if (selectedDocument === currentDocument && selectedProjectFolder != null) {
		return selectedProjectFolder
	}

	const projectFolder = findFirstRootProjectFile(settings.rootPath, URI.parse(currentDocument).fsPath)

	if (projectFolder == null) {
		selectedDocument = currentDocument
		return (selectedProjectFolder = settings.rootPath)
	}

	if (settings.linter) settings.linter.loadFileConfig(projectFolder)

	selectedProjectFolder = projectFolder
	selectedDocument = currentDocument

	return (ServerCompilers.rootPath = projectFolder)
}
