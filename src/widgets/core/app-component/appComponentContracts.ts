import type { WidgetContractId } from "@/widgets/types";
import {
  CORE_VALUE_BOOLEAN_CONTRACT,
  CORE_VALUE_INTEGER_CONTRACT,
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_NUMBER_CONTRACT,
  CORE_VALUE_SCALAR_CONTRACTS,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";

import type { AppComponentGeneratedFieldKind } from "./appComponentModel";
export {
  CORE_VALUE_BOOLEAN_CONTRACT,
  CORE_VALUE_INTEGER_CONTRACT,
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_NUMBER_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";

export function resolveAppComponentInputAcceptContracts(
  kind: AppComponentGeneratedFieldKind,
): WidgetContractId[] {
  switch (kind) {
    case "integer":
      return [...CORE_VALUE_SCALAR_CONTRACTS];
    case "number":
    case "boolean":
    case "date":
    case "date-time":
    case "enum":
    case "string":
      return [...CORE_VALUE_SCALAR_CONTRACTS];
    case "json":
      return [CORE_VALUE_JSON_CONTRACT, ...CORE_VALUE_SCALAR_CONTRACTS];
    default:
      return [...CORE_VALUE_SCALAR_CONTRACTS];
  }
}

export function resolveAppComponentOutputContract(
  kind: AppComponentGeneratedFieldKind,
): WidgetContractId {
  switch (kind) {
    case "integer":
      return CORE_VALUE_INTEGER_CONTRACT;
    case "number":
      return CORE_VALUE_NUMBER_CONTRACT;
    case "boolean":
      return CORE_VALUE_BOOLEAN_CONTRACT;
    case "json":
      return CORE_VALUE_JSON_CONTRACT;
    case "date":
    case "date-time":
    case "enum":
    case "string":
    default:
      return CORE_VALUE_STRING_CONTRACT;
  }
}
