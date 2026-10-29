import type { Split } from "#lib/api/types.js";
import {
  isEditableType,
  SHARED,
  type Side,
} from "#lib/components/editor/model.js";

export type FieldName =
  | "date"
  | "description"
  | "amount"
  | "source"
  | "destination"
  | "category"
  | "budget"
  | "tags"
  | "bill"
  | "notes";

export interface Row {
  field: FieldName;
  index: number;
  key: string;
}

export const FIELD_LABEL: Record<FieldName, string> = {
  amount: "amount",
  bill: "subscription",
  budget: "budget",
  category: "category",
  date: "date",
  description: "description",
  destination: "destination account",
  notes: "notes",
  source: "source account",
  tags: "tags",
};

const SIDES: Side[] = ["source", "destination"];

export const rowKey = (field: FieldName, index: number) => `${index}:${field}`;

export function rowsOf(splits: Split[]): Row[] {
  const type = splits[0]?.type ?? "";
  if (!isEditableType(type)) {
    return [];
  }
  const many = splits.length > 1;
  const withdrawal = type === "withdrawal";
  const locked = splits.some((split) => split.reconciled);
  const shared = SIDES.filter((side) => SHARED[type][side]);
  const top: FieldName[] = many
    ? ["date", ...(locked ? [] : shared)]
    : [
        "date",
        "description",
        ...(locked ? [] : (["amount", ...SIDES] as FieldName[])),
      ];
  const own = (split: Split): FieldName[] => [
    ...(many ? (["description"] as const) : []),
    ...(many && !split.reconciled
      ? ["amount" as const, ...SIDES.filter((side) => !SHARED[type][side])]
      : []),
    "category",
    ...(withdrawal ? (["budget"] as const) : []),
    "tags",
    ...(withdrawal ? (["bill"] as const) : []),
    "notes",
  ];
  return [
    ...top.map((field) => ({ field, index: 0 })),
    ...splits.flatMap((split, index) =>
      own(split).map((field) => ({ field, index }))
    ),
  ].map((row) => ({ ...row, key: rowKey(row.field, row.index) }));
}
