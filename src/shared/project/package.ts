import * as fs from "node:fs"
import * as path from "node:path"
import type { Project } from "./project"
import type { Remapping } from "./remapping"
export function createDefaultPackage(project: Project): Package {
	return new Package(project, project.rootPath)
}

export class Package {
	public name: string
	public version: string
	public src: string
	public outDir: string
	public rootPath: string
	public srcAbsolute: string
	public remappings: Remapping[]
	public dependencies: Package[]
	public parent: Package | null
	public libs: string[] = []
	public srcAlts: string[] = []
	public internal = false

	constructor(project: Project, packagePath: string, parent?: Package) {
		const isProject = project.rootPath === packagePath

		this.name = path.basename(packagePath)
		this.rootPath = packagePath
		this.parent = parent
		this.srcAlts = project.srcLibs

		this.src = isProject ? project.src : project.srcLibs.find((x) => fs.existsSync(path.join(packagePath, x)))

		this.srcAbsolute = this.src != null ? path.join(packagePath, this.src) : packagePath
		this.internal = isProject || packagePath.includes(project.srcAbsolute)

		this.libs = !this.internal ? project.libs.filter((x) => fs.existsSync(path.join(packagePath, x))) : []
		this.remappings = project.remappings.filter((r) => {
			const targetPath = path.join(project.rootPath, r.target)
			return isProject ? targetPath.includes(project.srcAbsolute) : targetPath.includes(packagePath)
		})

		this.outDir = project.solc.compiler.outDir
	}

	public fromSources(paths: string) {
		return path.join(this.srcAbsolute, paths)
	}

	public isImportForThis(importPath: string) {
		const splitDirectories = importPath.split("/")
		if (splitDirectories.length <= 1) return

		if (splitDirectories[0] === this.name) {
			return this.name
		}
		const remapping = this.remappings.find((r) => r.isImportForThis(importPath))
		if (remapping) return remapping.prefix
	}

	public resolveImport(importPath: string) {
		const prefix = this.isImportForThis(importPath)
		if (!prefix) return null

		const resolvedPath = path.join(this.srcAbsolute, importPath.substring(prefix.length))
		if (fs.existsSync(resolvedPath)) return resolvedPath
		return this.srcAlts.find((srcDir) =>
			fs.existsSync(path.join(this.rootPath, srcDir, importPath.substring(prefix.length))),
		)
		// for (let index = 0; index < this.srcAlts.length; index++) {
		// 	const directory = this.libs[index]
		// 	if (directory || directory === "") {
		// 		const fullpath = path.join(this.rootPath, directory, importPath.substring(prefix.length))
		// 		if (fs.existsSync(fullpath)) {
		// 			return fullpath
		// 		}
		// 	}
		// }
	}
}
