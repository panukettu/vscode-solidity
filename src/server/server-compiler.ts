import { Multisolc } from "@shared/compiler/multisolc"
import type { MultisolcSettings } from "@shared/types"

export let ServerCompilers: Multisolc
export let compilerInitialized = false
export let solcCachePath = ""

export function configureServerCachePath(path: string) {
	solcCachePath = path
}

export async function createServerMultisolc(settings: MultisolcSettings) {
	if (!solcCachePath) throw new Error("solcCachePath not set")
	ServerCompilers = new Multisolc(settings, solcCachePath)
	await ServerCompilers.initializeSolc(settings.selectedType)
	compilerInitialized = true
}

// async function initializeSolc(type: CompilerType) {
// 	const id = CompilerType[type]
// 	try {
// 		await ServerCompilers.initializeSolc(type)
// 		connection.console.info(`${id} solc ready (${ServerCompilers.getCompiler().getVersion()})`)
// 	} catch (reason) {
// 		connection.console.debug(`${id} solc initialization fail: ${reason}. Falling back to embedded..`)
// 		try {
// 			ServerCompilers.initExternalCompilers(getCurrentMultisolcSettings(cfg), CompilerType.Extension)
// 			await ServerCompilers.initializeSolc(CompilerType.Extension)
// 		} catch (e) {
// 			connection.console.debug(`Unhandled: ${e}`)
// 			return
// 		}
// 	}

// 	compilerInitialized = true
// }
