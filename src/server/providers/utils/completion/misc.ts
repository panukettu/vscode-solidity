import * as path from "path"
import { fileURLToPath } from "url"
import * as vscode from "vscode-languageserver/node"
import { CodeWalkerService } from "../../../codewalker"

export const textEdit = (path: string, range: vscode.Range, prefix: string) => {
	return vscode.InsertReplaceEdit.create(prefix + path + '";', range, range)
}

export const getImportPath = (
	file: string,
	dependencies: string[],
	document: vscode.TextDocument,
	walker: CodeWalkerService,
): [string, boolean] => {
	const item = path.join(file)
	const dependency = dependencies.find((x) => item.startsWith(x))
	const remapping = walker.project.findRemappingForFile(item)
	if (remapping) {
		if (remapping != null) {
			return [remapping.createImportFromFile(item).split("\\").join("/"), true]
		} else {
			if (dependency) {
				const importPath = item.substr(dependency.length + 1)
				return [importPath.split("\\").join("/"), false]
			}
			let rel = path.relative(fileURLToPath(document.uri), item)
			const folders = rel.split("\\")
			rel = folders.join("/")
			if (rel.startsWith("../")) {
				rel = rel.substr(1)
			}
			return [rel, folders.length < 3 ? true : false]
		}
	}
}
