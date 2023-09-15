export class ParsedCodeTypeHelper {
  public static getTypeString(literal: any) {
    const isArray = literal.array_parts?.length > 0;
    let isMapping = false;
    let literalType: any;
    let parentType: string = null;
    if (literal.members !== undefined && literal.members?.length > 0) {
      literalType = literal.members[0];
      parentType = literal.literal;
    } else {
      literalType = literal.literal;
    }

    let suffixType = "";

    if (typeof literalType.type !== "undefined") {
      isMapping = literalType.type === "MappingExpression";
      if (isMapping) {
        suffixType =
          "(" +
          this.getTypeString(literalType.from) +
          " => " +
          this.getTypeString(literalType.to) +
          ")";
      }
    }

    if (isArray) {
      const arraySuffix = !!literal.array_parts[0]
        ? literal.array_parts[0]
        : "";
      suffixType = suffixType + (arraySuffix ? `[${arraySuffix}]` : "[]");
    }

    if (isMapping) {
      return "mapping" + suffixType;
    }

    if (parentType !== null) {
      return parentType + "." + literalType + suffixType;
    }

    return literalType + suffixType;
  }
}

export const valueTypeReg =
  /(address|bool|string|bytes\d{0,2}|(uint|int)(\d|\W))/;
export const valueTypes = [
  "address",
  "bool",
  "string",
  "byte",
  "bytes",
  "uint",
  "int",
];
