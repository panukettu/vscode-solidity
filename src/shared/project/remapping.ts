import * as path from "node:path"
import { remapRegexp } from "@shared/regexp"
import { isPathSubdirectory } from "../util"
import type { Project } from "./project"

export class Remapping {
	public context: string
	public prefix: string
	public target: string
	public basePath: string
	public value: string
	public absolute: boolean
	constructor(remapping: string, basePath: string) {
		this.basePath = basePath
		this.value = remapping

		const match = remapRegexp().exec(remapping)
		if (!match) return
		if (match.groups.context) {
			this.context = match.groups.context
		}
		if (match.groups.prefix) {
			this.prefix = match.groups.prefix
			this.target = match.groups.target
		}
	}

	public isImportForThis(importPath: string) {
		if (this.context == null) return importPath.startsWith(this.prefix)
		return importPath.startsWith(`${this.context}:${this.prefix}`)
	}

	public getLibraryPathIfRelative(projectPath: string) {
		if (path.isAbsolute(this.target)) return null
		const fullPath = path.join(this.basePath, this.target)

		if (!isPathSubdirectory(projectPath, fullPath)) return null

		return path.dirname(this.target).split(path.sep)[0]
	}

	public createImportFromFile(filePath: string) {
		if (!this.isFileForThis(filePath)) return null
		if (path.isAbsolute(filePath)) {
			if (!this.context) return path.join(this.prefix, filePath.substring(this.target.length))
			return path.join(`${this.context}:${this.prefix}`, filePath.substring(this.target.length))
		}

		if (!this.context) return path.join(this.prefix, filePath.substring(path.join(this.basePath, this.target).length))
		return path.join(`${this.context}:${this.prefix}`, filePath.substring(path.join(this.basePath, this.target).length))
	}

	public isFileForThis(filePath: string) {
		if (!path.isAbsolute(filePath)) {
			return filePath.startsWith(this.target)
		}
		return filePath.startsWith(path.join(this.basePath, this.target))
	}

	public resolveImport(importPath: string): string | null {
		if (importPath == null || !this.isImportForThis(importPath)) return null

		const suffix = this.context
			? importPath.substring(`${this.context}:${this.prefix}`.length)
			: importPath.substring(this.prefix.length)

		if (!path.isAbsolute(importPath)) return path.join(this.target, suffix)
		return path.join(this.basePath, this.target, suffix)
	}
}

export function parseRemappings(remappings: string | string[], rootPath: string): Array<Remapping> {
	const remapList = Array.isArray(remappings) ? remappings : remappings.split(/\r\n|\r|\n/) // split lines
	return (remapList ?? []).map((value) => new Remapping(value, rootPath))
}
