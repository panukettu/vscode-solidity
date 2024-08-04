import * as fs from "node:fs"
import * as path from "node:path"
export function createDefaultPackage(packagePath: string, sources = "", outDir = "bin", libs: string[] = []): Package {
	const defaultPackage = new Package(sources, outDir)
	defaultPackage.absolutePath = packagePath
	defaultPackage.name = path.basename(packagePath)
	defaultPackage.sol_sources_alternative_directories = libs
	return defaultPackage
}

export class Package {
	public name: string
	public version: string
	public sol_sources: string
	public build_dir: string
	public absolutePath: string

	public dependencies: any
	public sol_sources_alternative_directories: string[] = []

	constructor(solSources: string, outDir: string) {
		this.build_dir = outDir
		this.sol_sources = solSources
	}

	public getSolSourcesAbsolutePath() {
		if (this.sol_sources !== undefined || this.sol_sources === "") {
			return path.join(this.absolutePath, this.sol_sources)
		}
		return this.absolutePath
	}

	public isImportForThis(contractDependencyImport: string) {
		const splitDirectories = contractDependencyImport.split("/")
		if (splitDirectories.length === 1) {
			return false
		}
		return splitDirectories[0] === this.name
	}

	public resolveImport(contractDependencyImport: string) {
		if (this.isImportForThis(contractDependencyImport)) {
			const defaultPath = path.join(
				this.getSolSourcesAbsolutePath(),
				contractDependencyImport.substring(this.name.length),
			)
			if (fs.existsSync(defaultPath)) {
				return defaultPath
			}
			for (let index = 0; index < this.sol_sources_alternative_directories.length; index++) {
				const directory = this.sol_sources_alternative_directories[index]
				if (directory !== undefined || directory === "") {
					const fullpath = path.join(this.absolutePath, directory, contractDependencyImport.substring(this.name.length))
					if (fs.existsSync(fullpath)) {
						return fullpath
					}
				}
			}
		}
		return null
	}
}
