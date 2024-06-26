import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as toml from "@iarna/toml"
import * as yaml from "yaml-js"
import type { FoundryConfig, FoundryConfigParsed, FoundryCoreConfig, SolidityConfig } from "../types"
import * as util from "../util"
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

export function getHardhatSourceFolder(rootPath: string): string | null {
	try {
		const hardhatConfigFile = path.join(rootPath, hardhatConfigFileName)
		if (!fs.existsSync(hardhatConfigFile)) return null
		const config = require(hardhatConfigFile)
		return config?.paths?.sources ?? null
	} catch (e) {
		return null
	}
}

export function getFoundryConfig(rootPath: string): FoundryConfigParsed | null {
	try {
		const cfg = toml.parse(fs.readFileSync(path.join(rootPath, foundryConfigFileName), "utf8")) as FoundryConfig
		const profile = "src" in cfg ? (cfg as unknown as FoundryCoreConfig) : cfg.profile.default
		return {
			profile,
			fmt: cfg?.fmt,
			etherscan: cfg?.etherscan,
			rpc_endpoints: cfg?.rpc_endpoints,
		}
	} catch (error) {
		console.debug("Unhandled (foundry config)", error.message)
		return null
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
		console.debug("Unhandled (remappings.txt)", e.message)
		return null
	}
}

export function loadRemappings(project: {
	rootPath: string
	foundryConfig?: FoundryConfigParsed
	cfg?: Partial<SolidityConfig>
}): string[] {
	return (
		project.foundryConfig?.profile.remappings ??
		project.cfg.project.remappings ??
		getRemappingsTxt(project.rootPath) ??
		getBrownieRemappings(project.rootPath) ??
		[]
	)
}
