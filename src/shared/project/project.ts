import { existsSync, readFileSync } from "node:fs"
import * as path from "node:path"
import type { Callbacks, SolcInput } from "@shared/compiler/types-solc"
import type { FoundryConfigParsed, SolidityConfig } from "@shared/types"
import { formatPath } from "@shared/util"
import { GlobSync, glob } from "glob"
import { filesCache, found, toCache } from "./cache"
import { createLibPackages } from "./dependency-utils"
import { type Package, createDefaultPackage } from "./package"
import { getFoundryConfig, getHardhatSourceFolder, loadRemappings } from "./project-utils"
import { type Remapping, parseRemappings } from "./remapping"
import type { SourceDocument } from "./sourceDocument"
import { SourceDocumentCollection } from "./sourceDocuments"

export class Project {
	public projectPackage: Package
	public libs: string[]
	public includePaths: string[]
	public excludes: string[]
	public remappings: Remapping[] = []
	public rootPath: string
	public foundryConfig: FoundryConfigParsed
	public src: string
	public srcLibs: string[]
	public srcAbsolute: string
	public solc: {
		settings: SolidityConfig["compilerSettings"]
		compiler: SolidityConfig["compiler"]
		ignoreErrorCodes?: string[]
	}
	private glob: InstanceType<typeof GlobSync>
	private globPath: string
	public contracts: SourceDocumentCollection
	constructor(config: SolidityConfig, rootPath: string) {
		this.rootPath = rootPath
		this.libs = config.project.libs.map(formatPath)
		this.excludes = config.project.exclude.map(formatPath)
		this.foundryConfig = getFoundryConfig(rootPath)

		this.src = config.project.sources || this.foundryConfig?.profile?.src || getHardhatSourceFolder(rootPath)
		this.srcLibs = config.project.libSources

		this.srcAbsolute = path.join(rootPath, this.src)

		this.remappings = parseRemappings(
			loadRemappings(this.rootPath, !!config.project.useForgeRemappings, this.libs, config.project.remappings),
			rootPath,
		)

		this.solc = {
			compiler: config.compiler,
			settings: config.compilerSettings,
			ignoreErrorCodes: config.validation?.ignoreErrorCodes?.map(String) ?? [],
		}

		this.projectPackage = createDefaultPackage(this)

		this.projectPackage.dependencies = createLibPackages(this)

		this.globPath = `${this.srcAbsolute}/**/*.sol`

		this.glob = new GlobSync(this.globPath, {
			ignore: ["node_modules/**/"],
		})
		this.contracts = new SourceDocumentCollection(this)
	}

	public addSource(filePath: string, code?: string) {
		return this.contracts.addSourceDocumentAndResolveImports(filePath, code)
	}

	public getMinSolcInput(remappings?: Remapping[]): SolcInput {
		return {
			language: "Solidity",
			settings: {
				viaIR: false,
				evmVersion: "cancun",
				remappings: remappings?.map((r) => r.value),
				optimizer: {
					enabled: false,
					runs: 0,
				},
				outputSelection: {
					"*": {
						"": [],
						"*": [],
					},
				},
			},
			sources: this.contracts.getSourceCodes(true, 300000),
		}
	}

	public findDependencyPackage(importPath: string) {
		return this.projectPackage.dependencies.find((lib: Package) => lib.isImportForThis(importPath))
	}

	public resolveImport(importPath: string, source?: SourceDocument): string {
		if (importPath[0] === "." && source) return source.resolveImportPath(importPath)

		const resolved = filesCache.tryResolve(importPath)
		if (found(resolved)) return resolved

		return resolved(
			this.findImportRemapping(importPath)?.resolveImport(importPath),
			this.findDependencyPackage(importPath)?.resolveImport(importPath),
			filesCache.find(importPath.replace(/['"]+/g, ""), true),
		)
	}

	private onlyProjectFiles() {
		return this.getCustomExcludes().concat(
			...this.libs
				.map((lib) => this.fromRoot(`${lib}/**/*.sol`))
				.concat(["**/node_modules/**", path.join(this.fromRoot(`${this.projectPackage.outDir}/**`))]),
		)
	}

	public getAllSolFiles() {
		if (filesCache.all.size) return Array.from(filesCache.all)
		return toCache(this.getProjectSolFiles().concat(this.getLibSolFiles()))
	}

	public getProjectSolFiles() {
		if (filesCache.project.size) return Array.from(filesCache.project)
		return toCache(this._getProjectSolFiles(), "project")
	}

	public getLibSolFiles() {
		if (filesCache.libs.size) return Array.from(filesCache.libs)
		return toCache(
			this.projectPackage.dependencies.flatMap((d) =>
				glob.sync(d.fromSources("/**/*.sol"), { ignore: this.getCustomExcludes() }),
			),
			"libs",
		)
	}

	public _getProjectSolFiles() {
		const exclusions = this.onlyProjectFiles()
		if (!this.src?.length) {
			for (const loc of this.getLibRelativeExcludes()) exclusions.push(loc)
		}

		return (this.glob = new GlobSync(this.globPath, { ...this.glob, ignore: exclusions })).found
	}

	public getLibRelativeExcludes(): string[] {
		return this.getRelativeLibRoots().map((x) => path.join(x, "**"))
	}

	public getAllRelativeLibRoots(): string[] {
		const results: string[] = []

		this.remappings.forEach((mapping) => {
			const dirLib = mapping.getLibraryPathIfRelative(this.srcAbsolute)
			if (dirLib != null && results.find((x) => x === dirLib) == null) {
				results.push(dirLib)
			}
		})
		return results
	}

	public getRelativeLibRoots() {
		return this.getAllRelativeLibRoots().map((x) => path.resolve(this.srcAbsolute, x))
	}

	public findImportRemapping(importPath: string): Remapping | null {
		// const remappings = importRemappings("@openzeppelin/=lib/openzeppelin-contracts//\r\nds-test/=lib/ds-test/src/", this);
		const remappings = this.remappings.filter((mapping) => mapping.isImportForThis(importPath))
		if (!remappings?.length) return null
		return this.sortRemappings(remappings)?.[0]
	}

	public findRemappingForFile(filePath: string): Remapping | undefined {
		return this.findRemappingsForFile(filePath, 3)?.[0]
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
			const relative = path.relative(from.includes(".") ? path.dirname(from) : from, match)
			results.add(!relative.startsWith(".") ? `./${relative}` : relative)
		}

		return Array.from(results)
			.sort((a, b) => a.length - b.length)
			.slice(0, max)
	}

	public fromRoot(paths: string) {
		return path.join(this.rootPath, paths)
	}
	public diffFromRoot(paths: string) {
		return paths.replace(this.rootPath, "").slice(1)
	}

	public getCustomExcludes() {
		return this.excludes?.map((item) => this.fromRoot(`${item}/**/*.sol`)) ?? []
	}
	public getRawRemappings() {
		return this.remappings.map((r) => r.value)
	}
	public getImportCallback(source?: SourceDocument): Callbacks {
		return {
			import: (importPath: string) => {
				const resolved = this.resolveImport(importPath, source)
				if (resolved && existsSync(resolved)) {
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

	private sortRemappings(array: Remapping[], filePath?: string) {
		if (!filePath) return array.sort((a, b) => a.prefix.length - b.prefix.length)
		return array.sort((a, b) => a.createImportFromFile(filePath).length - b.createImportFromFile(filePath).length)
	}

	// public getIncludePathFiles() {
	// 	if (!this.includePaths.length) return []
	// 	const dir = this.includePaths.length > 1 ? `{${this.includePaths.join(",")}}` : this.includePaths[0]
	// 	if (dir === this.cfg.project.sources) return this.getProjectSolFiles()

	// 	return new GlobSync(`${this.rootPath}/${dir}/**/*.sol`, {
	// 		ignore: ["**/node_modules/**/"],
	// 	}).found
	// }

	// this.includePaths = Array.from(
	// 	new Set((config.project?.includePaths ?? []).concat(this.foundryConfig.profile.include_paths ?? [])),
	// )
}
