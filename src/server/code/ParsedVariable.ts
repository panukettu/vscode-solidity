import { TypeReference } from "../search/TypeReference";
import { ParsedCode } from "./ParsedCode";
import { ParsedDeclarationType } from "./ParsedDeclarationType";

export class ParsedVariable extends ParsedCode {
  public type: ParsedDeclarationType;

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): TypeReference[] {
    if (this.isCurrentElementedSelected(offset)) {
      const foundType = this.type.findType();
      if (foundType !== undefined) {
        return [foundType.createFoundReferenceLocationResult()];
      }
      return [this.createFoundReferenceLocationResultNoLocation()];
    }
    return [this.createNotFoundReferenceLocationResult()];
  }

  public override getAllReferencesToObject(
    parsedCode: ParsedCode
  ): TypeReference[] {
    if (this.isTheSame(parsedCode)) {
      return [this.createFoundReferenceLocationResult()];
    } else {
      return this.type.getAllReferencesToObject(parsedCode);
    }
  }
}
