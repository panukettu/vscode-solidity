import * as fs from "node:fs"
import * as path from "node:path"
import type { MinimalURI, ScopedURI } from "./types"

type Stat = { num: number; str: string }
export function createDetails(...stats: Stat[]): string {
	const items = stats.filter((s) => s.num)
	return `[${items.map((s) => `${s.num} ${s.str}`).join(" / ")}]`
}
// import { URI } from 'vscode-uri';
export const toScopedURI = (scope: string, uri: MinimalURI): ScopedURI => `${scope}-${uri.toString()}`
// export const fromScopedURI = (scopedURI: ScopedURI): { scope: string; uri: vscode.Uri } => {
// 	const [scope, uri] = scopedURI.split('-');
// 	return { scope, uri: vscode.Uri.parse(uri) };
// };
export function formatPath(contractPath: string) {
	if (contractPath != null) {
		return contractPath.replace(/\\/g, "/")
	}
	return contractPath
}

/**
 * Replaces remappings in the first array with matches from the second array,
 * then it concatenates only the unique strings from the 2 arrays.
 *
 * It splits the strings by '=' and checks the prefix of each element
 * @param remappings first array of remappings strings
 * @param replacer second array of remappings strings
 * @returns an array containing unique remappings
 */
export function replaceRemappings(remappings: string[], replacer: string[]): string[] {
	remappings.forEach((remapping, index) => {
		const prefix = remapping.split("=")[0]
		for (const replaceRemapping of replacer) {
			const replacePrefix = replaceRemapping.split("=")[0]
			if (prefix === replacePrefix) {
				remappings[index] = replaceRemapping
				break
			}
		}
	})
	return [...new Set([...remappings, ...replacer])]
}

export function findDirUpwardsToCurrentDocumentThatContainsAtLeastFileNameSync(
	filenames: string[],
	currentDocument: string,
	rootPath: string,
) {
	let currentDir = path.dirname(path.resolve(currentDocument))

	while (currentDir !== rootPath) {
		if (exitsAnyFileSync(filenames, currentDir)) {
			return currentDir
		}

		currentDir = path.dirname(currentDir)
	}

	return null
}

export function exitsAnyFileSync(filenames: string[], dir: string) {
	for (const fileName of filenames) {
		const file = path.join(dir, fileName)
		if (fs.existsSync(file)) {
			return true
		}
	}
	return false
}

export function isPathSubdirectory(parent: string, dir: string) {
	const relative = path.relative(parent, dir)
	return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
}
