import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as toml from "@iarna/toml"
import { glob } from "glob"
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
			}
			return `${alias}=${path.join(os.homedir(), ".brownie", "packages", packageID)}`
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
				if (line.length > 0) remappings.push(line)
			}
		}
		return remappings
	} catch (e) {
		console.debug("Unhandled (remappings.txt)", e.message)
		return null
	}
}
function getLibRemappings(libFolder?: string): string[] {
	const configs = glob.sync(`${path.join(libFolder)}/**/foundry.toml`, { ignore: ["**/node_modules/**"] })
	if (!configs.length) return []

	const folders = configs.map((c) => path.dirname(c))
	if (!folders.length) return []

	return folders
		.flatMap((f) => {
			const remappings = getFoundryConfig(f)?.profile?.remappings
			if (!remappings) return []
			return remappings.map((r) => {
				const [remap, target] = r.split("=")
				return `${remap}=${f}/${target}`
			})
		})
		.filter((r) => r && r.length > 0)
}
export function loadRemappings(p: {
	rootPath: string
	foundry?: FoundryConfigParsed
	cfg?: Partial<SolidityConfig>
}): string[] {
	if (p.foundry?.profile && p.cfg?.project.useForgeRemappings) {
		const libs = p.cfg?.project?.libs ?? []
		const forgeRemaps = (execSync("forge remappings", { cwd: p.rootPath }).toString().split("\n") ?? []).filter(Boolean)
		return Array.from(new Set(forgeRemaps.concat(libs.flatMap((l) => getLibRemappings(l)))))
	}
	return p.cfg.project.remappings ?? getRemappingsTxt(p.rootPath) ?? getBrownieRemappings(p.rootPath) ?? []
}
