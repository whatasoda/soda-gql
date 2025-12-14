export type TypeModifier = string;

export interface TypeProfile {
  readonly kind: "scalar" | "enum" | "input";
  readonly name: string;
  readonly value: any;
}
