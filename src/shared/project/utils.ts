import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as toml from "@iarna/toml"
import * as yaml from "yaml-js"
import type { SolidityConfig } from "../types"
import * as util from "../util"
import { Package } from "./package"
import { Project } from "./project"

const packageConfigFileName = "dappFile"
const remappingConfigFileName = "remappings.txt"
const brownieConfigFileName = "brownie-config.yaml"
const hardhatConfigFileName = "hardhat.config.js"
const truffleConfigFileName = "truffle-config.js"
const foundryConfigFileName = "foundry.toml"

const projectFilesAtRoot = [
	remappingConfigFileName,
	brownieConfigFileName,
	foundryConfigFileName,
	hardhatConfigFileName,
	truffleConfigFileName,
	packageConfigFileName,
]

export function findFirstRootProjectFile(rootPath: string, currentDocument: string) {
	return util.findDirUpwardsToCurrentDocumentThatContainsAtLeastFileNameSync(
		projectFilesAtRoot,
		currentDocument,
		rootPath,
	)
}

function readYamlSync(filePath: string) {
	const fileContent = fs.readFileSync(filePath)
	return yaml.load(fileContent)
}

export function createProject(
	rootPath: string,
	config: SolidityConfig,
): {
	project: Project
	sources: string
	remappings: string[]
} {
	let sources = config.project.sources
	const foundrySources = getFoundrySourceFolder(rootPath)
	const hardhatSource = getHardhatSourceFolder(rootPath)
	if (!sources) {
		sources = foundrySources.src
	}
	if (!sources) {
		sources = hardhatSource
	}

	const projectPackage = createDefaultPackage(rootPath, sources, config.compiler.outDir)

	const dependencies: Package[] = getDependencyPackages(
		config.project.libs,
		rootPath,
		projectPackage,
		config.project.libSources,
	)
	const remappings = loadRemappings(rootPath, config.project.remappings)
	return {
		project: new Project(projectPackage, dependencies, config.project.libs, remappings, rootPath),
		sources: sources,
		remappings: remappings,
	}
}

function getDependencyPackages(libs: string[], rootPath: string, projectPackage: Package, sources: string[]) {
	let dependencies: Package[] = []
	libs.forEach((libDirectory) => {
		dependencies = dependencies.concat(createDependencies(rootPath, projectPackage, libDirectory, sources))
	})
	return dependencies
}

function getHardhatSourceFolder(rootPath: string): string | null {
	try {
		const hardhatConfigFile = path.join(rootPath, hardhatConfigFileName)
		if (fs.existsSync(hardhatConfigFile)) {
			const config = require(hardhatConfigFile)
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const sourceLocation: string = config["paths"]["sources"]
			if (sourceLocation) {
				return sourceLocation
			}
		}
		return null
	} catch (e) {
		return null
	}
}
function getFoundrySourceFolder(rootPath: string): { src: string; test: string; script: string } | null {
	const foundryConfigFile = path.join(rootPath, foundryConfigFileName)
	if (fs.existsSync(foundryConfigFile)) {
		try {
			const fileContent = fs.readFileSync(foundryConfigFile, "utf8")
			const configOutput = toml.parse(fileContent)
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const sourceLocation: string = configOutput["profile"]["default"]["src"]
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const scriptLocation: string = configOutput["profile"]["default"]["script"]
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			const testLocation: string = configOutput["profile"]["default"]["test"]
			if (!sourceLocation && !scriptLocation && !testLocation) {
				return null
			}
			return {
				src: sourceLocation,
				script: scriptLocation,
				test: testLocation,
			}
		} catch (error) {}
		return null
	}
	return null
}

function getFoundryRemappings(rootPath: string): string[] | null {
	const foundryConfigFile = path.join(rootPath, foundryConfigFileName)
	if (!fs.existsSync(foundryConfigFile)) return null

	try {
		const fileContent = fs.readFileSync(foundryConfigFile, "utf8")
		const configOutput = toml.parse(fileContent)
		// biome-ignore lint/complexity/useLiteralKeys: <explanation>
		const remappingsLoaded: string[] = configOutput["profile"]["default"]["remappings"]

		if (!remappingsLoaded || remappingsLoaded.length === 0) {
			return null
		}

		return remappingsLoaded
	} catch (error) {
		console.log("Unhandled (forge.remappings)", error.message)
	}
}

function getBrownieRemappings(rootPath: string): string[] {
	const brownieConfigFile = path.join(rootPath, brownieConfigFileName)
	if (!fs.existsSync(brownieConfigFile)) return null

	try {
		const config = readYamlSync(brownieConfigFile)

		const remappingsLoaded: string[] = config.compiler.solc.remappings
		if (!remappingsLoaded || remappingsLoaded.length === 0) {
			return null
		}
		const remappings = remappingsLoaded.map((i) => {
			const [alias, packageID] = i.split("=")
			if (packageID.startsWith("/")) {
				// correct processing for imports defined with global path
				return `${alias}=${packageID}`
			} else {
				return `${alias}=${path.join(os.homedir(), ".brownie", "packages", packageID)}`
			}
		})
		return remappings
		// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
	} catch (TypeError) {
		return null
	}
}

function getRemappingsTxt(rootPath: string) {
	const remappingsFile = path.join(rootPath, remappingConfigFileName)
	if (!fs.existsSync(remappingsFile)) return null
	try {
		const remappings = []
		const fileContent = fs.readFileSync(remappingsFile, "utf8")
		const remappingsLoaded = fileContent.split(/\r\n|\r|\n/) // split lines
		if (remappingsLoaded && remappingsLoaded.length > 0) {
			for (let i = 0; i < remappingsLoaded.length; i++) {
				const line = remappingsLoaded[i]
				if (line.length > 0) {
					// ignore empty lines and comments
					remappings.push(line)
				}
			}
		}
		return remappings
	} catch (e) {
		console.error("Unhandled (remappings.txt)", e.message)
		return null
	}
}

export function loadRemappings(rootPath: string, remappings: string[] = []): string[] {
	return getBrownieRemappings(rootPath) ?? getFoundryRemappings(rootPath) ?? getRemappingsTxt(rootPath) ?? remappings
}

function createDependencies(
	rootPath: string,
	projectPackage: Package,
	libLocation: string,
	libSourcesLocations: string[],
	libPackages: Array<Package> = new Array<Package>(),
) {
	const libPath = path.join(projectPackage.absoluletPath, libLocation)

	if (!fs.existsSync(libPath)) return libPackages

	for (const directory of getDirectories(libPath)) {
		const depPackage = createDefaultPackage(path.join(libPath, directory), undefined, projectPackage.build_dir)
		depPackage.sol_sources_alternative_directories = libSourcesLocations
		if (!libPackages.some((existingDepPack: Package) => existingDepPack.name === depPackage.name)) {
			libPackages.push(depPackage)

			createDependencies(rootPath, depPackage, libLocation, libSourcesLocations, libPackages)
		}
	}

	return libPackages
}

function getDirectories(dirPath: string): string[] {
	return fs.readdirSync(dirPath).filter(function (file) {
		const subdirPath = path.join(dirPath, file)
		return fs.statSync(subdirPath).isDirectory()
	})
}

function createDefaultPackage(packagePath: string, sources = "", outDir = "bin"): Package {
	const defaultPackage = new Package(sources, outDir)
	defaultPackage.absoluletPath = packagePath
	defaultPackage.name = path.basename(packagePath)
	return defaultPackage
}
