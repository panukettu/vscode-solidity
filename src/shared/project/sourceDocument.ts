import * as path from "node:path"
import { formatPath } from "../util"
import type { Project } from "./project"

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

	constructor(project: Project, absolutePath: string, code: string) {
		this.absolutePath = formatPath(absolutePath)
		this.code = code
		this.unformattedCode = code
		this.project = project
		this.imports = []
	}

	public getAllImportFromPackages() {
		return this.imports.filter((i) => !this.isImportLocal(i.importPath))
	}

	public isImportLocal(importPath: string) {
		return SourceDocument.isImportLocal(importPath)
	}

	public resolveImportPath(importPath: string) {
		if (this.isImportLocal(importPath)) return formatPath(path.resolve(path.dirname(this.absolutePath), importPath))
		return this.project.resolveImport(importPath, this)
	}
	public getImportCallback() {
		return this.project.getImportCallback(this)
	}

	public replaceDependencyPath(importPath: string, depImportAbsolutePath: string) {
		const importRegEx = /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm
		this.code = this.code.replace(importRegEx, (match, p1, p2, p3) => {
			if (p2 === importPath) return p1 + depImportAbsolutePath + p3
			return match
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
				const importFullPath = formatPath(path.resolve(path.dirname(this.absolutePath), importPath))
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
