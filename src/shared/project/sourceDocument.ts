import { readFileSync } from "node:fs"
import * as path from "path"
import type { Callbacks } from "@shared/compiler/types-solc"
import { formatPath } from "../util"
import { Project, resolveCache } from "./project"

type Import = {
	importPath: string
	symbols?: string[]
	isAs?: string
}

export class SourceDocument {
	public code: string
	public unformattedCode: string
	public imports: Array<Import>
	public absolutePath: string
	public packagePath: string
	public abi: string
	public project: Project

	public static getAllLibraryImports(code: string): string[] {
		const importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm
		const imports: string[] = []
		let foundImport = importRegEx.exec(code)
		while (foundImport != null) {
			const importPath = foundImport[1]

			if (importPath[0] !== ".") {
				imports.push(importPath)
			}

			foundImport = importRegEx.exec(code)
		}
		return imports
	}

	public static isImportLocal(importPath: string) {
		return importPath.startsWith(".")
	}

	constructor(absoulePath: string, code: string, project: Project) {
		this.absolutePath = this.formatDocumentPath(absoulePath)
		this.code = code
		this.unformattedCode = code
		this.project = project
		this.imports = new Array<Import>()
	}

	/**
	 * Resolve import statement to absolute file path
	 *
	 * @param {string} importPath import statement in *.sol contract
	 * @param {SourceDocument} contract the contract where the import statement belongs
	 * @returns {string} the absolute path of the imported file
	 */
	public resolveImportPath(importPath: string, files: string[], returnEmpty = false): string {
		if (resolveCache.has(importPath)) return resolveCache.get(importPath)
		let result = ""

		if (importPath[0] === ".") {
			result = path.resolve(path.dirname(this.absolutePath), importPath)
		}

		if (!result) result = this.project.projectPackage.resolveImport(importPath)

		if (!result || result === importPath) {
			result =
				this.project?.findImportRemapping(importPath)?.resolveImport(importPath) ??
				this.project?.findDependencyPackage(importPath)?.resolveImport(importPath)
		}

		if (!result || result === importPath) {
			const normalized = importPath.replace(/['"]+/g, "")
			result = files.find((x) => x.includes(normalized))
		}

		const out = result && result !== importPath ? this.formatDocumentPath(result) : returnEmpty ? null : importPath
		if (out && out !== importPath) resolveCache.set(importPath, out)
		return out
	}

	public getImportCallback(): Callbacks {
		this.project.checkCache()
		const solFiles = this.project.getIncludePathFiles()
		return {
			import: (path: string) => {
				const resolved = this.resolveImportPath(path, solFiles, true)
				if (!resolved) return { error: `File not found: ${path}` }
				resolveCache.set(path, resolved)
				return {
					contents: readFileSync(resolved).toString(),
				}
			},
		}
	}

	public getAllImportFromPackages() {
		const importsFromPackages = new Array<string>()

		for (const immported of this.imports) {
			if (!this.isImportLocal(immported.importPath)) {
				importsFromPackages.push(immported.importPath)
			}
		}
		return importsFromPackages
	}

	public isImportLocal(importPath: string) {
		return SourceDocument.isImportLocal(importPath)
	}

	public formatDocumentPath(contractPath: string) {
		return formatPath(contractPath)
	}

	public replaceDependencyPath(importPath: string, depImportAbsolutePath: string) {
		const importRegEx = /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm
		this.code = this.code.replace(importRegEx, (match, p1, p2, p3) => {
			if (p2 === importPath) {
				return p1 + depImportAbsolutePath + p3
			} else {
				return match
			}
		})
	}

	public resolveImports() {
		// const importRegExDunno = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
		// const importRegExPrev = /import\s\{?(.*?(?=\}))?([^'"]*['"](.*)['"])\s*/gm
		const importRegEx = /import\s\{?(.*?(?=\}))?([^'"]*['"](.*)['"])\s*(?:as\s)?(\w+)?/gm
		let foundImport = importRegEx.exec(this.code)

		while (foundImport != null) {
			let symbols = foundImport[1] ? foundImport[1].split(",").map((s) => s.trim()) : undefined

			const isAs = !symbols?.length && foundImport[4]
			if (isAs) symbols = [foundImport[4]]
			const importPath = foundImport[3]

			if (this.isImportLocal(importPath)) {
				const importFullPath = this.formatDocumentPath(path.resolve(path.dirname(this.absolutePath), importPath))
				this.imports.push({
					importPath: importFullPath,
					symbols: symbols,
					isAs,
				})
			} else {
				this.imports.push({
					importPath: importPath,
					symbols: symbols,
					isAs,
				})
			}

			foundImport = importRegEx.exec(this.code)
		}
	}
}
// import\s+(:{[^{}]+}|.*?)\s*(?:from)?\s*['"](.*?)['"]|import\(.*?\)

// import\s\{?(.*?(?=\}))?([^'"]*['"](.*)['"])\s*(?:as\s)(\w+)
