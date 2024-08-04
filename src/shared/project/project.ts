import * as path from "node:path"
import type { FoundryConfigParsed, SolidityConfig } from "@shared/types"
import { GlobSync, glob } from "glob"
import { createLibPackages } from "./dependency-utils"
import { type Package, createDefaultPackage } from "./package"
import { getFoundryConfig, getHardhatSourceFolder, loadRemappings } from "./project-utils"
import { type Remapping, parseRemappings } from "./remapping"

export const resolveCache: Map<string, string> = new Map()
export let filesCache: string[] = []

export class Project {
	public projectPackage: Package
	public dependencies: Array<Package>
	public libs: string[]
	public remappings: Remapping[]
	public rootPath: string
	public foundryConfig: FoundryConfigParsed
	public includePaths: string[]
	public cfg: SolidityConfig
	public cacheTime = Date.now()

	private glob: InstanceType<typeof GlobSync>
	private globPath: string
	private absoluteSources: string

	constructor(config: SolidityConfig, rootPath: string) {
		this.foundryConfig = getFoundryConfig(rootPath)
		this.rootPath = rootPath

		config.project.sources =
			config.project.sources || this.foundryConfig?.profile?.src || getHardhatSourceFolder(rootPath)

		this.cfg = config

		this.includePaths = Array.from(
			new Set((config.project?.includePaths ?? []).concat(this.foundryConfig.profile.include_paths ?? [])),
		)

		this.projectPackage = createDefaultPackage(
			rootPath,
			config.project.sources,
			config.compiler.outDir,
			this.includePaths.length ? this.includePaths : config.project.libs,
		)

		this.dependencies = createLibPackages(config.project.libs, rootPath, this.projectPackage, config.project.libSources)

		this.projectPackage.dependencies = this.dependencies
		this.libs = config.project.libs

		this.remappings = parseRemappings(loadRemappings(this), this)
		this.absoluteSources = this.projectPackage.getSolSourcesAbsolutePath()
		this.globPath = `${this.absoluteSources}/**/*.sol`

		this.glob = new GlobSync(this.globPath, {
			ignore: ["node_modules/**/"],
		})
	}

	// This will need to add the current package as a parameter to resolve version dependencies
	public findDependencyPackage(dependencyImport: string) {
		return this.dependencies.find((depPack: Package) => depPack.isImportForThis(dependencyImport))
	}
	private getDefaultExclusions() {
		return (
			this.cfg.project.exclude?.length
				? this.cfg.project.exclude.map((item) => path.join(this.rootPath, "**", item, "/**/*.sol"))
				: []
		).concat(["**/node_modules/**/"])
	}
	public getLibSourceFiles() {
		return Array.from(
			new Set(
				this.dependencies.flatMap((d) => {
					const lib = d.getSolSourcesAbsolutePath()
					return glob.sync(path.join(lib, "/**/*.sol"))
				}),
			),
		)
	}

	public getIncludePathFiles() {
		if (!this.includePaths.length) return []
		const dir = this.includePaths.length > 1 ? `{${this.includePaths.join(",")}}` : this.includePaths[0]
		if (dir === this.cfg.project.sources) return this.getProjectSolFiles()

		return new GlobSync(`${this.rootPath}/${dir}/**/*.sol`, {
			ignore: ["**/node_modules/**/"],
		}).found
	}

	public checkCache() {
		if (Date.now() - this.cacheTime > 10000) {
			filesCache = []
			this.cacheTime = Date.now()
		}
	}

	public getProjectSolFiles() {
		this.checkCache()
		if (filesCache.length === 0) {
			return this._getProjectSolFiles()
		}
		return filesCache
	}

	public _getProjectSolFiles() {
		const exclusions = this.getDefaultExclusions()
		if (this.rootPath !== this.absoluteSources) {
			this.glob = new GlobSync(this.globPath, { ...this.glob, ignore: exclusions })

			return (filesCache = this.glob.found)
		}

		exclusions.push(path.join(this.rootPath, this.projectPackage.build_dir, "**"))
		for (const libFolder of this.libs) {
			exclusions.push(path.join(this.rootPath, libFolder, "**"))
		}

		for (const x of this.getAllRelativeLibrariesAsExclusionsFromRemappings()) {
			exclusions.push(x)
		}
		this.glob = new GlobSync(this.globPath, { ...this.glob, ignore: exclusions })
		return (filesCache = this.glob.found)
	}

	public getAllRelativeLibrariesAsExclusionsFromRemappings(): string[] {
		return this.getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths().map((x) => path.join(x, "**"))
	}

	public getAllRelativeLibrariesRootDirsFromRemappings(): string[] {
		const results: string[] = []

		this.remappings.forEach((mapping) => {
			const dirLib = mapping.getLibraryPathIfRelative(this.projectPackage.getSolSourcesAbsolutePath())
			if (dirLib != null && results.find((x) => x === dirLib) == null) {
				results.push(dirLib)
			}
		})
		return results
	}

	public getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths() {
		return this.getAllRelativeLibrariesRootDirsFromRemappings().map((x) =>
			path.resolve(this.projectPackage.getSolSourcesAbsolutePath(), x),
		)
	}

	public findImportRemapping(importPath: string): Remapping {
		// const remappings = importRemappings("@openzeppelin/=lib/openzeppelin-contracts//\r\nds-test/=lib/ds-test/src/", this);
		const remappings = this.remappings.filter((mapping) => mapping.isImportForThis(importPath))
		if (!remappings?.length) return null
		return this.sortRemappings(remappings)[0]
	}

	public findDirectImport(absolutePath: string): string {
		for (const includePath of this.includePaths) {
			const includePathResolved = path.resolve(this.rootPath, includePath)
			if (absolutePath.startsWith(includePathResolved)) {
				let result = absolutePath.replace(`${includePathResolved}`, "")
				result = result.startsWith("/") ? result.substring(1) : result
				if (result.indexOf("/") === 0) return `./${result}`
				return result
			}
		}
		return absolutePath
	}

	public findShortestImport(from: string, importPath: string): string {
		let result = this.findRemappingForFile(importPath)?.createImportFromFile(importPath)
		if (!result) result = this.findImportRemapping(importPath)?.createImportFromFile(importPath)
		if (!result) result = this.findDirectImport(importPath)
		if (result && result !== importPath) return result
		return path.relative(path.dirname(from), importPath)
	}

	public findRemappingForFile(filePath: string): Remapping {
		const remappings = this.remappings.filter((mapping) => mapping.isFileForThis(filePath))
		if (!remappings?.length) return null
		return this.sortRemappings(remappings, filePath)[0]
	}

	public findRemappingsForFile(filePath: string, count: number): Remapping[] {
		const remappings = this.remappings.filter((mapping) => mapping.isFileForThis(filePath))
		if (!remappings?.length) return null
		return this.sortRemappings(remappings, filePath).slice(0, count)
	}

	public getPossibleImports(from: string, filePath: string, max = 5): string[] {
		const fileName = filePath.split("/").pop()
		const matches = glob.sync(path.join(this.rootPath, "/**/", fileName), {
			ignore: ["**/node_modules/**"],
			nodir: true,
			nocase: true,
		})

		if (!matches?.length) return []

		const results = new Set<string>()

		for (const match of matches) {
			const remappings = this.findRemappingsForFile(match, 3)
			if (remappings?.length) remappings.forEach((r) => results.add(r.createImportFromFile(match)))
			// results.add(this.findDirectImport(match))
			// results.add(this.findShortestImport(from, match))
			const relative = path.relative(from.includes(".") ? path.dirname(from) : from, match)
			results.add(!relative.startsWith(".") ? `./${relative}` : relative)
		}

		return Array.from(results)
			.sort((a, b) => a.length - b.length)
			.slice(0, max)
	}

	private sortRemappings(array: Remapping[], filePath?: string) {
		if (!filePath) return array.sort((a, b) => a.prefix.length - b.prefix.length)
		return array.sort((a, b) => a.createImportFromFile(filePath).length - b.createImportFromFile(filePath).length)
	}

	private sortByLength(array: any[]) {
		return array.sort((a, b) => a.length - b.length)
	}
}
