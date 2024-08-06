import * as fs from "node:fs"
import * as path from "node:path"
import type { Remapping } from "./remapping"
export function createDefaultPackage(
	remappings: Remapping[],
	name: string,
	rootPath: string,
	solSources = "",
	outDir = "bin",
	libs: string[] = [],
): Package {
	return new Package(remappings, name, rootPath, solSources, libs, outDir)
}

export class Package {
	public name: string
	public version: string
	public solSources: string
	public outDir: string
	public rootPath: string
	public remappings: Remapping[]
	public dependencies: Package[]
	public parent: Package | null
	public libs: string[] = []

	constructor(
		remappings: Remapping[],
		name: string,
		rootPath: string,
		solSources: string,
		libs: string[],
		outDir: string,
		parent?: Package,
	) {
		this.parent = parent
		this.name = path.basename(parent ? rootPath.replace(parent.rootPath, "") : rootPath)
		this.solSources = solSources
		this.rootPath = rootPath
		// const remappingsParsed = remappings.map((x) => {
		// 	const base = x.includes(":") ? x.split(":")[1] : x // ignore context

		// 	const [prefix, targetDir] = base.split("=")
		// 	return { prefix, targetDir, rootPath: path.join(rootPath, targetDir) }
		// })
		this.remappings = remappings.filter((r) => r.target.includes(this.name))
		this.libs = libs.filter((x) => fs.existsSync(path.join(rootPath, x)))
		this.outDir = outDir
	}

	public getSolRootPath() {
		if (this.solSources || this.solSources === "") {
			return path.join(this.rootPath, this.solSources)
		}
		return this.rootPath
	}

	public fromRoot(paths: string) {
		return path.join(this.getSolRootPath(), paths)
	}

	public isImportForThis(importPath: string) {
		return !!this.parseImport(importPath)
	}

	public parseImport(importPath: string) {
		const parts = importPath.replace(this.rootPath, "").split("/")
		const base = parts.indexOf(this.name)

		if (base === -1) {
			const remapping = this.remappings.find((r) => r.isImportForThis(importPath) || r.isFileForThis(importPath))

			if (remapping) return { prefix: remapping.prefix, targetDir: remapping.target, rootPath: remapping.basePath }
		}

		if (base === 0)
			return {
				prefix: this.name,
				targetDir: this.solSources,
				rootPath: this.getSolRootPath(),
			}

		if (parts[0].startsWith(".")) {
			return { prefix: parts.slice(0, base + 1).join(""), targetDir: this.solSources, rootPath: this.getSolRootPath() }
		}

		return null
	}

	public resolveImport(importPath: string): string | undefined {
		const parsed = this.parseImport(importPath)
		if (!parsed) return null

		const sharedPart = importPath.slice(parsed.prefix.length)
		const result = path.join(parsed.rootPath, sharedPart)

		if (fs.existsSync(result)) return result
		return this.libs.map((lib) => path.join(this.rootPath, lib, sharedPart)).find((x) => fs.existsSync(x))
	}
}
