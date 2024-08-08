import type { request } from "@server/handlers/requests"
import type { Hex } from "viem"
import type { DiagnosticsCollection } from "./types"
export type Result<T extends keyof ClientRequest> = Promisify<ReturnType<(typeof request)[T]>>

type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
export type ClientRequest = {
	"diagnostics.clear": {
		type: "diagnostics.clear"
		args?: {
			uri: string
		}
	}
	"diagnostics.set": {
		type: "diagnostics.set"
		args: {
			diagnostics: DiagnosticsCollection
			openProblems?: boolean
		}
	}
	"selector.find": {
		type: "selector.find"
		args: {
			selector: Hex
		}
	}
	keccak256: {
		type: "keccak256"
		args: {
			input: unknown
		}
	}
	encode: {
		type: "encode"
		args: {
			input: [types: string, values: string]
		}
	}
	decode: {
		type: "decode"
		args: {
			input: [types: string, value: Hex]
		}
	}
}
export type ClientArgs<T extends keyof ClientRequest> = ClientRequest[T]["args"]
export type ClientRequests = ClientRequest[keyof ClientRequest]
