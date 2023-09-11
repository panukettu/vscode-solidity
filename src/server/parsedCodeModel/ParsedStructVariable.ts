import { CompletionItem } from "vscode-languageserver";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedEnum } from "./ParsedEnum";
import { ParsedStruct } from "./ParsedStruct";
import { ParsedVariable } from "./ParsedVariable";
import { ParsedContract } from "./parsedContract";
import { ParsedDeclarationType } from "./parsedDeclarationType";
import { ParsedCustomType } from "./ParsedCustomType";

export class ParsedStructVariable extends ParsedVariable {
  public struct: ParsedStruct;
  private completionItem: CompletionItem = null;
  public abiType: string | null;

  public properties: ParsedStructVariable[];
  public items: any[];

  public initialiseStructVariable(
    element: any,
    contract: ParsedContract,
    document: ParsedDocument,
    struct: ParsedStruct,
    typeRef?: ParsedStruct | ParsedEnum | ParsedCustomType
  ) {
    this.element = element;
    this.name = element.name;
    this.document = document;
    this.type = ParsedDeclarationType.create(
      element.literal,
      contract,
      document
    );

    this.struct = struct;
    if (typeRef instanceof ParsedStruct) {
      this.properties = typeRef.properties;
      this.abiType = `(${this.properties.map((p) => p.abiType).join(",")})`;
    } else if (typeRef instanceof ParsedEnum) {
      this.items = typeRef.items;
      this.abiType = this.type.isArray ? "uint8[]" : "uint8";
    } else if (typeRef instanceof ParsedCustomType) {
      this.abiType = typeRef.isType + (this.type.isArray ? "[]" : "");
    } else {
      this.abiType = this.type.valueType
        ? this.type.name + (this.type.isArray ? "[]" : "")
        : null;
    }
  }
  public createCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      const completitionItem = CompletionItem.create(this.name);
      completitionItem.documentation = this.getMarkupInfo();
      this.completionItem = completitionItem;
    }
    return this.completionItem;
  }

  public override getParsedObjectType(): string {
    return "Struct Property";
  }

  public override getInfo(): string {
    return (
      "### " +
      this.getParsedObjectType() +
      ": " +
      this.name +
      "\n" +
      "#### " +
      this.struct.getParsedObjectType() +
      ": " +
      this.struct.name +
      "\n" +
      "#### " +
      this.getContractNameOrGlobal() +
      "\n" +
      // '\t' +  this.getSignature() + ' \n\n' +
      "### Type Info: \n" +
      this.type.getInfo() +
      "\n" +
      this.getComment()
    );
  }
}
