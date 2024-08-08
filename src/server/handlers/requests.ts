import { connection } from "@server"
import { getCodeWalkerService } from "@server/server-utils"
import type { ClientArgs, ClientRequest } from "@shared/types-request"
import { decode, encode, getSelector, hash } from "./shared"

type Handlers = {
	[request in keyof ClientRequest]: (args: ClientArgs<request>) => Promise<any> | any
}

export const request = {
	keccak256: (args) => hash(args.input),
	encode: (args) => encode(args.input),
	decode: (args) => decode(args.input),
	"selector.find": async (args) => {
		try {
			for (const doc of getCodeWalkerService().parsedDocumentsCache) {
				for (const item of doc.getAllFunctionsAndErrors()) {
					if (getSelector(item.getSelector()) === args.selector) {
						return item.getLocation()
					}
				}
			}
			return `"No match found for ${args.selector}`
		} catch (e) {
			console.debug("selector.find:", e.message)
		}
	},
	"diagnostics.set": async (args) => {
		try {
			let sent = false
			args.diagnostics.forEach(([uri, diagnostics]) => {
				if (!sent) sent = diagnostics.length > 0
				connection.sendDiagnostics({ uri, diagnostics })
			})

			if (sent && args.openProblems) connection.sendRequest("openProblemsPane")
		} catch (e) {
			console.debug("diagnostics.set:", e.message)
		}
	},
	"diagnostics.clear": async (args) => {
		try {
			if (!args?.uri) {
				return await Promise.all(
					getCodeWalkerService().parsedDocumentsCache.map((doc) =>
						connection.sendDiagnostics({ uri: doc.sourceDocument.absolutePath, diagnostics: [] }),
					),
				)
			}
			return await connection.sendDiagnostics({ uri: args.uri, diagnostics: [] })
		} catch (e) {
			console.debug("diagnostics.clear:", e.message)
		}
	},
} satisfies Handlers
