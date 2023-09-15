import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedCodeTypeHelper } from "./ParsedCodeTypeHelper";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedVariable } from "./ParsedVariable";
import { ElementParams } from "./Types";
import { FindTypeReferenceLocationResult, ParsedCode } from "./parsedCode";
import { ParsedContract } from "./parsedContract";
import { ParsedDeclarationType } from "./parsedDeclarationType";

const getNatspecPrefix = (text: string) => {
  const isVowel = text.match(/^[aeiou]/i);
  const article = isVowel ? "An" : "A";

  return `${article} ${text}`;
};

function pluralize(word: string) {
  const wordLower = word.toLowerCase();
  if (/[^aeiou]y$/i.test(wordLower)) {
    return word.replace(/y$/i, "ies");
  } else if (/[sxz]$/i.test(wordLower) || /[^aeioudgkprt]h$/i.test(wordLower)) {
    return word + "es";
  } else if (/[^aeiou]o$/i.test(wordLower)) {
    return word + "es";
  } else if (wordLower.toLowerCase() === "child") {
    return "children";
  } else {
    return word + "s";
  }
}
export class ParsedParameter extends ParsedVariable {
  public parent: ParsedCode;
  private completionItem: CompletionItem = null;
  public element: ElementParams;

  public isInput: boolean = false;
  public isOutput: boolean = false;

  public static extractParameters(
    params: ElementParams[],
    contract: ParsedContract,
    document: ParsedDocument,
    parent: ParsedCode,
    isInput: boolean,
    isOutput: boolean
  ): ParsedParameter[] {
    const parameters: ParsedParameter[] = [];
    if (params == null) return parameters;
    params.forEach((parameterElement) => {
      const parameter: ParsedParameter = new ParsedParameter();
      parameter.initialiseParameter(
        parameterElement,
        contract,
        document,
        parent
      );
      parameter.isInput = isInput;
      parameter.isOutput = isOutput;
      parameters.push(parameter);
    });

    return parameters;
  }

  public static createParamsInfo(params: any): string {
    let paramsInfo = "";
    if (typeof params !== "undefined" && params !== null) {
      if (params.hasOwnProperty("params")) {
        params = params.params;
      }
      params.forEach((parameterElement) => {
        const currentParamInfo = ParsedParameter.getParamInfo(parameterElement);
        if (paramsInfo === "") {
          paramsInfo = currentParamInfo;
        } else {
          paramsInfo = paramsInfo + ", " + currentParamInfo;
        }
      });
    }
    return paramsInfo;
  }
  public static createParamsInfoForSig(params: any): string {
    let paramsInfo = "";
    if (typeof params !== "undefined" && params !== null) {
      if (params.hasOwnProperty("params")) {
        params = params.params;
      }
      params.forEach((parameterElement) => {
        const currentParamInfo =
          ParsedParameter.getParamInfoSig(parameterElement);
        if (paramsInfo === "") {
          paramsInfo = currentParamInfo;
        } else {
          paramsInfo = paramsInfo + "," + currentParamInfo;
        }
      });
    }
    return paramsInfo;
  }

  public static getParamInfo(parameterElement: ElementParams) {
    const typeString = ParsedCodeTypeHelper.getTypeString(
      parameterElement.literal
    );

    let currentParamInfo = "";
    if (
      typeof parameterElement.id !== "undefined" &&
      parameterElement.id !== null
    ) {
      // no name on return parameters
      currentParamInfo = typeString;
    } else {
      currentParamInfo = typeString;
    }
    return currentParamInfo;
  }
  public static getParamInfoSig(parameterElement: any) {
    return ParsedCodeTypeHelper.getTypeString(parameterElement.literal);
  }

  public static createFunctionParamsSnippet(
    params: ElementParams[],
    skipFirst = false
  ): string {
    let paramsSnippet = "";
    let counter = 0;
    if (typeof params !== "undefined" && params !== null) {
      params.forEach((parameterElement) => {
        if (
          (skipFirst && counter === 0) ||
          parameterElement.id === "self" ||
          parameterElement.id === "_self"
        ) {
          skipFirst = false;
        } else {
          const typeString = ParsedCodeTypeHelper.getTypeString(
            parameterElement.literal
          );
          counter = counter + 1;
          const currentParamSnippet =
            "${" + counter + ":" + parameterElement.id + "}";
          if (paramsSnippet === "") {
            paramsSnippet = currentParamSnippet;
          } else {
            paramsSnippet = paramsSnippet + ", " + currentParamSnippet;
          }
        }
      });
    }
    return paramsSnippet;
  }

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      if (this.type.isCurrentElementedSelected(offset)) {
        return this.type.getAllReferencesToSelected(offset, documents);
      } else {
        return this.getAllReferencesToThis(documents);
      }
    }
    return [];
  }

  public override getAllReferencesToObject(
    parsedCode: ParsedCode
  ): FindTypeReferenceLocationResult[] {
    if (this.isTheSame(parsedCode)) {
      return [this.createFoundReferenceLocationResult()];
    } else {
      return this.type.getAllReferencesToObject(parsedCode);
    }
  }

  public override getAllReferencesToThis(
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
    const results: FindTypeReferenceLocationResult[] = [];
    results.push(this.createFoundReferenceLocationResult());
    return results.concat(this.parent.getAllReferencesToObject(this));
  }

  public initialiseParameter(
    element: ElementParams,
    contract: ParsedContract,
    document: ParsedDocument,
    parent: ParsedCode
  ) {
    this.element = element;
    this.name = element.name;
    this.document = document;
    this.contract = contract;
    this.parent = parent;

    const type = ParsedDeclarationType.create(
      element.literal,
      contract,
      document
    );
    this.element = element;
    this.type = type;
    if (typeof element.id !== "undefined" && element.id !== null) {
      // no name on return parameters
      this.name = element.id;
    }
  }

  public createParamCompletionItem(
    type: string,
    contractName: string
  ): CompletionItem {
    if (this.completionItem === null) {
      let id = "[parameter name not set]";
      if (this.element.id !== null) {
        id = this.element.id;
      }
      const completionItem = CompletionItem.create(id);
      completionItem.kind = CompletionItemKind.Variable;
      completionItem.documentation = this.getMarkupInfo();
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public createFieldCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      let id = "[unnamed]";
      if (this.element.id !== null) {
        id = this.element.id;
      }
      const completionItem = CompletionItem.create(id);
      completionItem.kind = CompletionItemKind.Field;
      completionItem.preselect = !!this.element.id;
      completionItem.detail =
        this.getElementInfo() + " (in " + this.parent.name + ")";
      completionItem.documentation = {
        kind: "markdown",
        value: this.getSimpleDetail(true),
      };
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public generateParamNatSpec(): string {
    const prefix = this.isInput ? "param" : "return";
    const typeInfo = this.getTypeInfo(true);

    const name = this.element.id ? this.element.id : this.type.name;
    return ` * @${prefix} ${name} ${name !== typeInfo ? typeInfo : ""}`;
  }

  public override getParsedObjectType(): string {
    if (this.isInput) {
      return "input param";
    } else if (this.isOutput) {
      return "output param";
    }
    return "param";
  }

  public getComment(): string {
    const parentComment = this.parent.getComment();
    if (!parentComment?.length) return;
    if (this.isInput) {
      const regex2 = new RegExp(`@param\\s${this.name}\\s(\.*\\w)`, "g");
      const matches = regex2.exec(parentComment);
      if (matches?.length > 1) {
        return matches[1];
      }
    } else if (this.isOutput) {
      const regexNamed = new RegExp(`@return\\s${this.name}\\s(\.*\\w)`, "g");
      const matchesNamed = regexNamed.exec(parentComment);
      if (matchesNamed?.length > 1) {
        return matchesNamed[1];
      }
      const regexUnnamed = new RegExp(`@return\\s+(\.+\\w)`, "g");
      const matches = regexUnnamed.exec(parentComment);
      if (matches?.length > 1) {
        return matches[1];
      }
    }
    return "";
  }

  public override getInfo(): string {
    return this.getSimpleDetail();
  }

  public getSimpleDetail(short?: boolean, isSignatureHelp?: boolean): string {
    let infoText = "";
    if (this.isInput) {
      infoText = `(...${this.getElementInfo()})`;
    } else if (this.isOutput) {
      infoText = `(...): ${this.getElementInfo()}`;
    } else {
      infoText = `: ${this.getElementInfo()}`;
    }

    if (isSignatureHelp) {
      return this.createSimpleDetail(
        !short && this.getRootName(),
        this.parent.name,
        infoText,
        this.isInput ? "arg" : "output",
        true,
        true
      );
    }
    return this.createSimpleDetail(
      !short && this.getRootName(),
      this.parent.name,
      infoText,
      !short ? this.getParsedObjectType() : this.isInput ? "arg" : "output",
      !short,
      !short
    );
  }

  public getStorageType(space = true): string {
    let result = "";
    if (this.element.storage_location) {
      result = this.element.storage_location + (space ? " " : "");
    }
    return result;
  }

  public getTypeInfo(readable = false): string {
    const isArray = this.type.getArraySignature();
    if (readable) {
      const prefix = getNatspecPrefix(this.type.name);
      let name = "";
      if (this.name) {
        const result = this.name.replace(/^_/, "").split(/(?=[A-Z])/);

        const letters = result
          .filter((x) => x.length === 1)
          .join("")
          .toUpperCase();
        name = result
          .filter((x) => x.length > 1)
          .map((x) => x.toLowerCase().trim())
          .concat(letters)
          .filter(Boolean)
          .join(" ");
      }

      const inputText =
        this.type.name !== "address"
          ? `The ${name} (${this.type.name}).`
          : name.indexOf("address") !== -1
          ? `The ${name}.`
          : `The ${name} address.`;
      const arrayParts = this.type.getArrayParts();
      return isArray
        ? `List of ${!!arrayParts ? arrayParts + " " : ""}${pluralize(
            this.type.name
          )}.`
        : this.isInput
        ? inputText
        : this.name
        ? `${prefix} value.`
        : `Result of ${this.parent.name}.`;
    }
    return this.type.name + isArray;
  }
  public getElementInfo(): string {
    const id = this.element.id != null ? this.element.id : "";
    return this.getTypeInfo() + " " + this.getStorageType() + id;
  }

  public getSignature(): string {
    return ParsedParameter.getParamInfo(this.element);
  }
}
