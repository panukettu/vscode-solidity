import { deepEqual } from "fast-equals"
import { URI } from "vscode-uri"
import { findFirstRootProjectFile } from "../shared/project/utils"
import { CodeWalkerService } from "./codewalker"
import { ServerCompilers } from "./server-compiler"
import { config, settings } from "./server-config"

export let selectedDocument = null
export let selectedProjectFolder = null

export let codeWalkerService: CodeWalkerService = null

export function initCommon(document: any) {
	if (typeof document.uri === "string") {
		initWorkspaceRootFolder(document.uri)
		return initCurrentProjectInWorkspaceRootFsPath(document.uri)
	} else if (typeof document.uri === "object") {
		initWorkspaceRootFolder(document.uri.external)
		return initCurrentProjectInWorkspaceRootFsPath(document.uri.external)
	}
}

export function getCodeWalkerService() {
	if (codeWalkerService != null) {
		if (codeWalkerService.rootPath === selectedProjectFolder && deepEqual(codeWalkerService.config, config)) {
			return codeWalkerService
		}
	}
	codeWalkerService = new CodeWalkerService(selectedProjectFolder, config)
	return codeWalkerService
}

export function initWorkspaceRootFolder(uri: string) {
	if (!ServerCompilers) throw new Error("1ServerCompilers not initialized")
	if (!settings) throw new Error("1settings not initialized")

	if (settings.rootPath) return

	const fullUri = URI.parse(uri)
	if (!fullUri.fsPath.startsWith(settings.rootPath)) {
		if (settings.workspaceFolders) {
			const newRootFolder = settings.workspaceFolders.find((x) => uri.startsWith(x.uri))
			if (newRootFolder != null) {
				settings.rootPath = URI.parse(newRootFolder.uri).fsPath
				ServerCompilers.rootPath = settings.rootPath
				if (settings.linter != null) {
					settings.linter.loadFileConfig(settings.rootPath)
				}
			}
		}
	}
}

export function initCurrentProjectInWorkspaceRootFsPath(currentDocument: string) {
	if (!ServerCompilers) throw new Error("2ServerCompilers not initialized")
	if (!settings) throw new Error("2settings not initialized")

	if (config.project.monorepo) {
		if (selectedDocument === currentDocument && selectedProjectFolder != null) {
			return selectedProjectFolder
		}
		const projectFolder = findFirstRootProjectFile(settings.rootPath, URI.parse(currentDocument).fsPath)
		if (projectFolder == null) {
			selectedProjectFolder = settings.rootPath
			selectedDocument = currentDocument

			return settings.rootPath
		} else {
			selectedProjectFolder = projectFolder
			selectedDocument = currentDocument
			ServerCompilers.rootPath = projectFolder
			if (settings.linter != null) {
				settings.linter.loadFileConfig(projectFolder)
			}
			return projectFolder
		}
	} else {
		// we might have changed settings
		ServerCompilers.rootPath = settings.rootPath
		selectedProjectFolder = settings.rootPath
		selectedDocument = currentDocument
		return settings.rootPath
	}
}
