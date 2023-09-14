import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { ParsedCodeTypeHelper, valueTypeReg } from "./ParsedCodeTypeHelper";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedEnum } from "./ParsedEnum";
import { ParsedParameter } from "./ParsedParameter";
import { ParsedStructVariable } from "./ParsedStructVariable";
import { FindTypeReferenceLocationResult, ParsedCode } from "./parsedCode";
import { ParsedContract } from "./parsedContract";
import { Element, LiteralMapping } from "./Types";
import { providerRequest } from "../definitionProvider";

export class ParsedStruct extends ParsedCode {
  public properties: ParsedStructVariable[] = [];
  public id: any;
  private completionItem: CompletionItem = null;
  public abiType: string;
  public hasMapping: boolean;
  public element: Element;

  public initialise(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    isGlobal: boolean
  ) {
    this.contract = contract;
    this.element = element;
    this.id = element.id;
    this.name = element.name;
    this.document = document;
    this.isGlobal = isGlobal;
    if (this.element.body?.length) {
      this.element.body.forEach((structBodyElement) => {
        if (structBodyElement.type === "DeclarativeExpression") {
          const literalType = structBodyElement.literal.literal;

          const isMapping = literalType?.type === "MappingExpression";
          const isValueType =
            !isMapping && valueTypeReg.test(literalType as unknown as string);
          let typeRef: ParsedStruct | ParsedEnum;

          if (!isValueType && !isMapping) {
            if (contract?.findType) {
              typeRef = contract.findType(literalType as any) as typeof typeRef;
            }
            if (!typeRef && !typeRef?.name && document?.findType) {
              typeRef = document.findType(literalType as any) as typeof typeRef;
            }
          } else if (isMapping) {
            const toType = (literalType as LiteralMapping).to.literal;
            let resultingType = "";
            if (toType.type === "MappingExpression") {
              resultingType = toType.to.literal;
            } else {
              resultingType = toType;
            }

            const isValueType = valueTypeReg.test(resultingType);
            if (!isValueType) {
              if (providerRequest.selectedDocument) {
                typeRef = providerRequest.selectedDocument.findType(
                  resultingType
                ) as typeof typeRef;
              }
              if (!typeRef?.name && contract?.findType) {
                typeRef = contract.findType(resultingType) as typeof typeRef;
              }
              if (!typeRef?.name && document?.findItem) {
                typeRef = document.findItem(resultingType) as typeof typeRef;
              }
            }
          }

          const variable = new ParsedStructVariable();
          variable.initialiseStructVariable(
            structBodyElement,
            this.contract,
            this.document,
            this,
            typeRef
          );
          if (isMapping) {
            this.hasMapping = true;
          }
          this.properties.push(variable);
        }
      });
      this.abiType = this.hasMapping
        ? "invalid"
        : `(${this.properties.map((p) => p.abiType)})`;
    } else {
      console.debug("No body for struct", element);
    }
  }

  public getInnerMembers(): ParsedCode[] {
    return this.properties;
  }

  public getVariableSelected(offset: number) {
    return this.properties.find((x) => {
      return x.isCurrentElementedSelected(offset);
    });
  }

  public override getSelectedItem(offset: number): ParsedCode {
    if (this.isCurrentElementedSelected(offset)) {
      const variableSelected = this.getVariableSelected(offset);
      if (variableSelected !== undefined) {
        return variableSelected;
      } else {
        return this;
      }
    }
    return null;
  }

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      const variableSelected = this.getVariableSelected(offset);
      if (variableSelected !== undefined) {
        return variableSelected.getSelectedTypeReferenceLocation(offset);
      } else {
        return [FindTypeReferenceLocationResult.create(true)];
      }
    }
    return [FindTypeReferenceLocationResult.create(false)];
  }

  public createCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = this.initCompletionItem();
      completionItem.kind = CompletionItemKind.Struct;
      completionItem.insertText = this.name;
      completionItem.detail = this.getDetail();
      completionItem.documentation = this.getMarkupInfo();
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getInnerCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.properties.forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      const selectedProperty = this.getSelectedProperty(offset);
      if (selectedProperty !== undefined) {
        return selectedProperty.getAllReferencesToThis(documents);
      } else {
        return this.getAllReferencesToThis(documents);
      }
    }
    return [];
  }

  public getSelectedProperty(offset: number) {
    return this.properties.find((x) => x.isCurrentElementedSelected(offset));
  }
  public override getContractNameOrGlobal(): string {
    return "";
  }
  public getDetail() {
    return this.isGlobal
      ? `File Level ${this.getParsedObjectType()}`
      : this.getParsedObjectType();
  }

  public override getParsedObjectType(): string {
    return "Struct";
  }
  public getElementInfo() {
    let storageType = "";
    if (this.hasMapping) {
      storageType = "storage";
    }

    return this.name + (storageType ? ` ${storageType}` : "");
  }
  public override getInfo(): string {
    const properties =
      this.properties.length > 0
        ? this.properties
            .map((p) =>
              p
                ? "\t" +
                  ParsedParameter.getParamInfo(p.element as any) +
                  " " +
                  p.name +
                  "\n"
                : ""
            )
            .join("")
        : "";

    return (
      this.createSimpleDetail(
        this.getRootName(),
        "",
        this.getElementInfo(),
        undefined,
        true,
        true
      ) +
      "\n" +
      properties
    );
  }
}
