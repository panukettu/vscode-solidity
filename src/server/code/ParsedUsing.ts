import { ParsedCode } from "./ParsedCode";
import { ParsedDeclarationType } from "./ParsedDeclarationType";
import { ParsedContract } from "./ParsedContract";
import { ParsedDocument } from "./ParsedDocument";
import { TypeReference } from "../search/TypeReference";

export class ParsedUsing extends ParsedCode {
  public for: ParsedDeclarationType;
  public forStar = false;

  public override getInfo(): string {
    const forIsArray = this.for.getArraySignature();
    return this.createInfo(
      "",
      "",
      `${this.name} for ${this.getRootName()}.${
        this.for.name + forIsArray || "*"
      }`,
      undefined,
      true,
      false
    );
  }

  public getParsedObjectType(): string {
    return this.isGlobal ? "using global" : "using";
  }

  public initialise(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    isGlobal: boolean
  ) {
    this.contract = contract;
    this.element = element;
    this.name = element.library.literal;
    this.document = document;
    this.isGlobal = isGlobal;

    if (element.for === "*") {
      this.forStar = true;
      this.for = null;
    } else {
      this.for = ParsedDeclarationType.create(
        element.for,
        this.contract,
        this.document
      );
    }
  }

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): TypeReference[] {
    if (this.isCurrentElementedSelected(offset)) {
      if (this.for !== null) {
        const foundType = this.for.findType();
        if (foundType !== undefined) {
          return [foundType.createFoundReferenceLocationResult()];
        }
        return [this.createFoundReferenceLocationResultNoLocation()];
      }
    }
    return [this.createNotFoundReferenceLocationResult()];
  }
}
