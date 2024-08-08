import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as toml from "@iarna/toml"
import * as yaml from "yaml-js"
import type { FoundryConfig, FoundryConfigParsed, FoundryCoreConfig } from "../types"
import * as util from "../util"

const packageConfigFileName = "dappFile"
const txtRemappings = "remappings.txt"
const brownieConfigFileName = "brownie-config.yaml"
const hardhatConfigFileName = "hardhat.config.js"
const truffleConfigFileName = "truffle-config.js"
const foundryConfigFileName = "foundry.toml"

const projectFilesAtRoot = [
	txtRemappings,
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
		return require(path.join(rootPath, hardhatConfigFileName))?.paths?.sources ?? null
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

function getBrownieRemappings(rootPath: string) {
	try {
		const brownieConfigFile = path.join(rootPath, brownieConfigFileName)
		const config = readYamlSync(brownieConfigFile)

		return (
			(config.compiler?.solc?.remappings as string[]) ??
			[].map((i) => {
				const [alias, packageID] = i.split("=")
				if (packageID.startsWith("/")) return `${alias}=${packageID}` // correct processing for imports defined with global path
				return `${alias}=${path.join(os.homedir(), ".brownie", "packages", packageID)}`
			})
		)
	} catch (err: any) {
		return []
	}
}

function getRemappingsTxt(rootPath: string) {
	try {
		return fs
			.readFileSync(path.join(rootPath, txtRemappings), "utf8")
			.split(/\r\n|\r|\n/)
			.filter((l) => l.length)
	} catch (e) {
		return []
	}
}
// function getLibRemappings(libFolder?: string): string[] {
// 	const configs = glob.sync(`${path.join(libFolder)}/**/foundry.toml`, { ignore: ["**/node_modules/**"] })
// 	if (!configs.length) return []

// 	return (
// 		configs
// 			?.flatMap((loc) => {
// 				const dir = path.dirname(loc)
// 				const remappings = getFoundryConfig(dir)?.profile?.remappings ?? []
// 				return remappings.map((r) => {
// 					const [remap, target] = r.split("=")
// 					return `${remap}=${dir}/${target}`
// 				})
// 			})
// 			.filter((r) => r?.length) ?? []
// 	)
// }

export function loadRemappings(
	rootPath: string,
	useForge: boolean,
	libs: string[],
	remappings: string[] = [],
): string[] {
	if (!useForge) return remappings.concat(getRemappingsTxt(rootPath) ?? getBrownieRemappings(rootPath) ?? [])

	const result = (execSync("forge remappings", { cwd: rootPath }).toString().split("\n") ?? []).filter(Boolean)
	return Array.from(new Set(remappings.concat(result)))
}
