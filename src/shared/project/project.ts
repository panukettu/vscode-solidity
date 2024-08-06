import { existsSync, readFileSync } from "node:fs"
import * as path from "node:path"
import type { Callbacks } from "@shared/compiler/types-solc"
import type { FoundryConfigParsed, SolidityConfig } from "@shared/types"
import { formatPath } from "@shared/util"
import { GlobSync, glob } from "glob"
import { createLibPackages } from "./dependency-utils"
import { type Package, createDefaultPackage } from "./package"
import { getFoundryConfig, getHardhatSourceFolder, loadRemappings } from "./project-utils"
import { type Remapping, parseRemappings } from "./remapping"
import type { SourceDocument } from "./sourceDocument"
import { SourceDocumentCollection } from "./sourceDocuments"

type ImportPath = string
type Source = string

const cache = {
	all: new Set<Source>(),
	project: new Set<Source>(),
	libs: new Set<Source>(),
	resolved: new Map<ImportPath, Source>(),
}
export const filesCache = {
	...cache,
	lastSize: 0,
	resolver:
		(importPath: string) =>
		(...resolved: string[]) => {
			const result = resolved.find((res) => res && existsSync(path.normalize(res)))
			if (!result) return null
			cache.resolved.set(path.normalize(importPath), path.normalize(result))
			return result
		},
	tryResolve: (importPath: ImportPath) => {
		const source = cache.resolved.get(path.normalize(importPath))
		if (source) return source
		return filesCache.resolver(importPath)
	},
	find: (str: string, partial = false) => {
		for (const item of cache.all) if (item === str || (partial && item.includes(str))) return item
	},
	clear: () => {
		cache.all.clear()
		cache.project.clear()
		cache.libs.clear()
		cache.resolved.clear()
	},
}

type CacheKey = Exclude<keyof typeof cache, "resolved">
function ok(res: ReturnType<typeof filesCache.tryResolve>) {
	return typeof res === "string"
}
function cached(files: string[], scope?: CacheKey) {
	files.forEach((file) => {
		filesCache.all.add(file)
		if (scope) filesCache[scope].add(file)
	})
	filesCache.lastSize = filesCache.all.size
	return files
}

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
	public contracts: SourceDocumentCollection

	constructor(config: SolidityConfig, rootPath: string) {
		this.foundryConfig = getFoundryConfig(rootPath)
		config.project.sources =
			config.project.sources || this.foundryConfig?.profile?.src || getHardhatSourceFolder(rootPath)
		this.libs = config.project.libs.map(formatPath)

		this.contracts = new SourceDocumentCollection()
		this.rootPath = rootPath

		this.cfg = config

		this.includePaths = Array.from(
			new Set((config.project?.includePaths ?? []).concat(this.foundryConfig.profile.include_paths ?? [])),
		)

		this.cfg.project.remappings = loadRemappings({
			foundry: this.foundryConfig,
			cfg: this.cfg,
			rootPath: this.rootPath,
		})
		this.remappings = parseRemappings(this.cfg.project.remappings, rootPath)

		this.projectPackage = createDefaultPackage(
			this.remappings,
			path.dirname(rootPath).split(path.sep).pop(),
			rootPath,
			config.project.sources,
			config.compiler.outDir,
			this.includePaths.length ? this.includePaths : config.project.libs,
		)

		this.dependencies = createLibPackages(
			this.remappings,
			rootPath,
			config.project.libs,
			this.projectPackage,
			config.project.libSources,
		)

		this.absoluteSources = this.projectPackage.getSolRootPath()
		this.globPath = `${this.absoluteSources}/**/*.sol`

		this.glob = new GlobSync(this.globPath, {
			ignore: ["node_modules/**/"],
		})
	}

	public absoluteFromRoot(paths: string) {
		if (!paths.includes(this.rootPath)) throw new Error(`Unrelated path: ${paths}. Project: ${this.rootPath}`)
		return paths.replace(this.rootPath, "")
	}
	public fromRoot(paths: string) {
		return path.join(this.rootPath, paths)
	}
	public fromSources(paths: string) {
		return path.join(this.absoluteSources, paths)
	}
	// public getImportCallback(): Callbacks {
	// 	this.project.checkCache()
	// 	const solFiles = this.project.getIncludePathFiles()
	// 	return {
	// 		import: (importPath: string) => {
	// 			const resolved = this.resolveImportPath(importPath, solFiles, true)

	// 			if (resolved && existsSync(resolved)) {
	// 				resolveCache.set(importPath, resolved)
	// 				return {
	// 					contents: readFileSync(resolved).toString(),
	// 				}
	// 			}

	// 			const suggestions = this.project.getPossibleImports(this.absolutePath, importPath)
	// 			return {
	// 				error: suggestions.length ? `\nSuggestions:\n${suggestions.join("\n ")}` : "\nNo suggestions found.",
	// 			}
	// 		},
	// 	}
	// }
	public getImportCallback(source?: SourceDocument): Callbacks {
		return {
			import: (importPath: string) => {
				const resolved = this.resolveImport(importPath, source)

				if (resolved && existsSync(resolved)) {
					cache.resolved.set(importPath, resolved)
					return {
						contents: readFileSync(resolved).toString(),
					}
				}

				const suggestions = this.getPossibleImports(source.absolutePath, importPath)
				return {
					error: suggestions.length ? `\nSuggestions:\n${suggestions.join("\n ")}` : "\nNo suggestions found.",
				}
			},
		}
	}

	// This will need to add the current package as a parameter to resolve version dependencies
	public findDependencyPackage(importPath: string) {
		return this.dependencies.find((lib: Package) => lib.isImportForThis(importPath))
	}

	public resolveImport(importPath: string, source?: SourceDocument): string {
		if (importPath[0] === "." && source) return path.resolve(path.dirname(source.absolutePath), importPath)

		const resolved = filesCache.tryResolve(importPath)
		if (ok(resolved)) return resolved

		return resolved(
			path.resolve(this.rootPath, importPath),
			this.projectPackage.resolveImport(importPath),
			this.findImportRemapping(importPath)?.resolveImport(importPath),
			this.findDependencyPackage(importPath)?.resolveImport(importPath),
			filesCache.find(importPath.replace(/['"]+/g, ""), true),
		)
	}
	private onlyProjectFiles() {
		const excludes = this.cfg.project.exclude?.map((item) => this.fromRoot(`${item}/**/*.sol`)) ?? []
		excludes.push(...this.libs.map((lib) => this.fromRoot(`${lib}/**/*.sol`)).concat(excludes, ["**/node_modules/**"]))
		excludes.push(path.join(this.fromRoot(`${this.projectPackage.outDir}/**`)))

		return excludes
	}

	// public getIncludePathFiles() {
	// 	if (!this.includePaths.length) return []
	// 	const dir = this.includePaths.length > 1 ? `{${this.includePaths.join(",")}}` : this.includePaths[0]
	// 	if (dir === this.cfg.project.sources) return this.getProjectSolFiles()

	// 	return new GlobSync(`${this.rootPath}/${dir}/**/*.sol`, {
	// 		ignore: ["**/node_modules/**/"],
	// 	}).found
	// }

	public getAllSolFiles() {
		if (filesCache.all.size) return Array.from(filesCache.all)
		return cached(this.getProjectSolFiles().concat(this.getLibSolFiles()))
	}
	public getProjectSolFiles() {
		if (filesCache.project.size) return Array.from(filesCache.project)
		return cached(this._getProjectSolFiles(), "project")
	}

	public getLibSolFiles() {
		if (filesCache.libs.size) return Array.from(filesCache.libs)
		return cached(
			this.dependencies.flatMap((d) => glob.sync(d.fromRoot("/**/*.sol"))),
			"libs",
		)
	}

	public _getProjectSolFiles() {
		const exclusions = this.onlyProjectFiles()
		if (this.projectPackage.solSources?.length) {
			return (this.glob = new GlobSync(this.globPath, { ...this.glob, ignore: exclusions })).found
		}

		for (const x of this.getAllRelativeLibrariesAsExclusionsFromRemappings()) {
			exclusions.push(x)
		}
		return (this.glob = new GlobSync(this.globPath, { ...this.glob, ignore: exclusions })).found
	}

	public getAllRelativeLibrariesAsExclusionsFromRemappings(): string[] {
		return this.getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths().map((x) => path.join(x, "**"))
	}

	public getAllRelativeLibrariesRootDirsFromRemappings(): string[] {
		const results: string[] = []

		this.remappings.forEach((mapping) => {
			const dirLib = mapping.getLibraryPathIfRelative(this.projectPackage.getSolRootPath())
			if (dirLib != null && results.find((x) => x === dirLib) == null) {
				results.push(dirLib)
			}
		})
		return results
	}

	public getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths() {
		return this.getAllRelativeLibrariesRootDirsFromRemappings().map((x) =>
			path.resolve(this.projectPackage.getSolRootPath(), x),
		)
	}

	public findImportRemapping(importPath: string): Remapping {
		// const remappings = importRemappings("@openzeppelin/=lib/openzeppelin-contracts//\r\nds-test/=lib/ds-test/src/", this);
		const remappings = this.remappings.filter((mapping) => mapping.isImportForThis(importPath))
		if (!remappings?.length) return null
		return this.sortRemappings(remappings)[0]
	}

	// public findDirectImport(absolutePath: string): string {
	// 	if (!this.includePaths.length) return absolutePath
	// 	for (const includePath of this.includePaths) {
	// 		const includePathResolved = path.resolve(this.rootPath, includePath)
	// 		if (absolutePath.startsWith(includePathResolved)) {
	// 			let result = absolutePath.replace(`${includePathResolved}`, "")
	// 			result = result.startsWith("/") ? result.substring(1) : result
	// 			if (result.indexOf("/") === 0) return `./${result}`
	// 			return result
	// 		}
	// 	}
	// 	return absolutePath
	// }

	public findShortestImport(from: string, importPath: string): string {
		let result = this.findRemappingForFile(importPath)?.createImportFromFile(importPath)
		if (!result) result = this.findImportRemapping(importPath)?.createImportFromFile(importPath)
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
