export const codeMap = new Map<string, boolean>();
export const documentMap = new Map<string, boolean>();
export const contractMap = new Map<string, boolean>();
export const clearCaches = () => {
  codeMap.clear();
  documentMap.clear();
  contractMap.clear();
};
