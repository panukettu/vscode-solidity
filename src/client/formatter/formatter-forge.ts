import * as cp from "node:child_process"
import { getCurrentProjectInWorkspaceRootFsPath } from "@client/client-config"
import * as vscode from "vscode"

export async function formatDocument(
	document: vscode.TextDocument,
	context: vscode.ExtensionContext,
): Promise<vscode.TextEdit[]> {
	const firstLine = document.lineAt(0)
	const lastLine = document.lineAt(document.lineCount - 1)
	const fullTextRange = new vscode.Range(firstLine.range.start, lastLine.range.end)
	const rootPath = getCurrentProjectInWorkspaceRootFsPath()
	const formatted = await formatDocumentInternal(document.getText(), rootPath)
	return [vscode.TextEdit.replace(fullTextRange, formatted)]
}

async function formatDocumentInternal(documentText: string, rootPath: string): Promise<string> {
	return await new Promise<string>((resolve, reject) => {
		const forge = cp.execFile("forge", ["fmt", "--raw", "-"], { cwd: rootPath }, (err, stdout) => {
			if (err != null) {
				console.debug("forge-fmt", err.message)
				return reject(err)
			}

			resolve(stdout)
		})

		forge.stdin?.write(documentText)
		forge.stdin?.end()
	})
}
