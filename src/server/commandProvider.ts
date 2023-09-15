import { getFunctionSelector, keccak256, toBytes } from "viem";
import { ExecuteCommandParams, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CodeWalkerService } from "./parsedCodeModel/codeWalkerService";
export const SERVER_COMMANDS_LIST = {
  ["function.selector"]: "solidity.server.lens.function.selector",
  ["string.keccak256"]: "solidity.server.lens.string.keccak256",
  ["function.natspec"]: "solidity.server.lens.function.natspec",
};

export class ExecuteCommandProvider {
  public static executeCommand(
    params: ExecuteCommandParams,
    document: TextDocument,
    range: Range,
    walker: CodeWalkerService
  ) {
    return commandMap[params.command](params, document, range, walker);
  }
}

const funcSig = (
  params: ExecuteCommandParams,
  document: TextDocument,
  range: Range,
  walker: CodeWalkerService
) => {
  try {
    const selected = walker.getSelectedDocument(document, range.start);
    const item = selected.getSelectedItem(document.offsetAt(range.start));

    // @ts-expect-error
    return getFunctionSelector(item.getSelector());
  } catch (e) {
    throw new Error("lens.server.function.selector failed: " + e.message);
  }
};
const funcNatspec = (
  params: ExecuteCommandParams,
  document: TextDocument,
  range: Range,
  walker: CodeWalkerService
) => {
  try {
    const selected = walker.getSelectedDocument(document, range.start);
    const func = selected.getSelectedFunction(document.offsetAt(range.start));
    return func.generateNatSpec();
  } catch (e) {
    throw new Error("lens.server.function.natspec failed: " + e.message);
  }
};
export const hash = (
  params: ExecuteCommandParams,
  document: TextDocument,
  range: Range,
  walker: CodeWalkerService
) => {
  try {
    const text = document.getText(range);
    return keccak256(toBytes(text));
  } catch (e) {
    throw new Error("lens.server.string.keccak256 failed: " + e.message);
  }
};

const commandMap = {
  [SERVER_COMMANDS_LIST["string.keccak256"]]: hash,
  [SERVER_COMMANDS_LIST["function.selector"]]: funcSig,
  [SERVER_COMMANDS_LIST["function.natspec"]]: funcNatspec,
};

type ExecutionArgs = {
  params: ExecuteCommandParams;
  document: TextDocument;
  position: Range;
  walker: CodeWalkerService;
};
