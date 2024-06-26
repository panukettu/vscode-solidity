import * as path from "path"
import type { FoundryConfigParsed, SolidityConfig } from "@shared/types"
import { GlobSync, glob } from "glob"
import { createLibPackages } from "./dependency-utils"
import { Package, createDefaultPackage } from "./package"
import { getFoundryConfig, getHardhatSourceFolder, loadRemappings } from "./project-utils"
import { Remapping, parseRemappings } from "./remapping"

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
			this.includePaths,
		)

		this.dependencies = createLibPackages(config.project.libs, rootPath, this.projectPackage, config.project.libSources)

		this.projectPackage.dependencies = this.dependencies
		this.libs = config.project.libs

		this.remappings = parseRemappings(loadRemappings(this), this)

		// console.debug(
		// 	this.foundryConfig,
		// 	"root",
		// 	rootPath,
		// 	"Project sources:",
		// 	config.project.sources,
		// 	"set",
		// 	config.project.sources.trim(),
		// 	"foundry",
		// 	this.foundryConfig?.profile?.src,
		// 	this.projectPackage,
		// )

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
				? this.cfg.project.exclude.map((item) => path.join(this.absoluteSources, "**", item, "/**/*.sol"))
				: []
		).concat(["node_modules/**/"])
	}
	public getLibSourceFiles() {
		return Array.from(
			new Set(
				this.dependencies.flatMap((d) => {
					const lib = d.getSolSourcesAbsolutePath()
					return d.sol_sources_alternative_directories.flatMap((dir) => glob.sync(path.join(lib, dir, "/**/*.sol")))
				}),
			),
		)
	}

	public getIncludePathFiles() {
		if (!this.includePaths.length) return []
		const dir = this.includePaths.length > 1 ? `{${this.includePaths.join(",")}}` : this.includePaths[0]
		if (dir === this.cfg.project.sources) return this.getProjectSolFiles()

		return new GlobSync(`${this.rootPath}/${dir}/**/*.sol`, {
			ignore: ["node_modules/**/"],
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

			console.debug("Exclusions", exclusions, this.globPath, this.glob.found.length)
			return (filesCache = this.glob.found)
		}
		for (const libFolder of this.libs) {
			exclusions.push(path.join(this.rootPath, libFolder, "**"))
		}

		exclusions.push(path.join(this.rootPath, this.projectPackage.build_dir, "**"))

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
		return this.sortByLength(remappings)[remappings.length - 1]
	}

	public findDirectImport(absolutePath: string): string {
		for (const includePath of this.includePaths.concat([...this.cfg.project.libs])) {
			const includePathResolved = path.resolve(this.rootPath, includePath)
			if (absolutePath.startsWith(includePathResolved)) {
				const result = absolutePath.replace(`${includePathResolved}`, "")
				return result.startsWith("/") ? result.substring(1) : result
			}
		}
		return absolutePath
	}

	public findShortestImport(from: string, importPath: string): string {
		let result = this.findImportRemapping(importPath)?.createImportFromFile(importPath)
		if (!result) result = this.findRemappingForFile(importPath)?.createImportFromFile(importPath)
		if (!result) result = this.findDirectImport(importPath)
		if (result && result !== importPath) return result
		return path.relative(path.dirname(from), importPath)
	}

	public findRemappingForFile(filePath: string): Remapping {
		const remappings = this.remappings.filter((mapping) => mapping.isFileForThis(filePath))
		if (!remappings?.length) return null
		return this.sortByLength(remappings)[remappings.length - 1]
	}

	private sortByLength(array: any[]) {
		return array.sort(function (a, b) {
			return a.length - b.length
		})
	}
}
