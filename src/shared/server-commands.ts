export const SERVER_COMMANDS_LIST = {
	"function.selector": "solidity.server.lens.function.selector",
	"function.selectors": "solidity.server.lens.function.selectors",
	"error.selectors": "solidity.server.lens.error.selectors",
	"string.keccak256": "solidity.server.lens.string.keccak256",
	"input.keccak256": "solidity.server.input.keccak256",
	"input.encode": "solidity.server.input.encode",
	"input.decode": "solidity.server.input.decode",
	"function.natspec": "solidity.server.lens.function.natspec",
	"diagnostic.clear": "solidity.server.diagnostic.clear",
	"diagnostic.set": "solidity.server.diagnostic.set",
} as const

const INPUT_COMMANDS = [
	SERVER_COMMANDS_LIST["input.keccak256"],
	SERVER_COMMANDS_LIST["input.encode"],
	SERVER_COMMANDS_LIST["input.decode"],
] as const

export function isInputCommand(command: string): command is (typeof INPUT_COMMANDS)[number] {
	return INPUT_COMMANDS.includes(command as any)
}
