import * as vscode from 'vscode';
import { findFirstRootProjectFile } from '../common/projectService';
import { replaceRemappings } from '../common/util';
import { SettingsService } from './settingsService';

export function getCurrentProjectInWorkspaceRootFsPath() {
	const monoreposupport = SettingsService.getMonoRepoSupport();
	const currentRootPath = getCurrentWorkspaceRootFsPath();
	if (monoreposupport) {
		const editor = vscode.window.activeTextEditor;
		const currentDocument = editor.document.uri;
		const projectFolder = findFirstRootProjectFile(currentRootPath, currentDocument.fsPath);
		if (projectFolder == null) {
			return currentRootPath;
		} else {
			return projectFolder;
		}
	} else {
		return currentRootPath;
	}
}

export function getCurrentWorkspaceRootFsPath() {
	return getCurrentWorkspaceRootFolder();
}

export function getCurrentWorkspaceRootFolder() {
	const editor = vscode.window.activeTextEditor;
	const currentDocument = editor.document.uri;
	if (!currentDocument) return vscode.workspace.rootPath;
	const workspace = vscode.workspace.getWorkspaceFolder(currentDocument);
	if (!workspace) return vscode.workspace.rootPath;
	return workspace.uri.fsPath;
}

export function getSolidityRemappings(): string[] {
	const remappings = SettingsService.getRemappings();
	if (process.platform === 'win32') {
		return replaceRemappings(remappings, SettingsService.getRemappingsWindows());
	} else {
		return replaceRemappings(remappings, SettingsService.getRemappingsUnix());
	}
}
