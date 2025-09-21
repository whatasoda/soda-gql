type AbstractTypeRef<TKind extends string> = {
  kind: TKind;
  name: string;
  format: TypeFormat;
};

export type TypeFormat =
  | "?" // nullable, no-default
  | "?=" // nullable, with-default
  | "?[]?" // nullable, list, no-default
  | "?[]?=" // nullable, list, with-default
  | "?[]!" // nullable, list, with-default
  | "?[]!=" // nullable, list, with-default
  | "!" // non-nullable, no-default
  | "!=" // non-nullable, with-default
  | "![]?" // non-nullable, list, no-default
  | "![]?=" // non-nullable, list, with-default
  | "![]!" // non-nullable, list, with-default
  | "![]!="; // non-nullable, list, with-default

type UnwrapListTypeFormat<TFormat extends TypeFormat> = {
  "?": "?";
  "?=": "?=";
  "?[]?": "?";
  "?[]?=": "?";
  "?[]!": "?";
  "?[]!=": "?";
  "!": "!";
  "!=": "!=";
  "![]?": "!";
  "![]?=": "!";
  "![]!": "!";
  "![]!=": "!";
}[TFormat];

export type ApplyTypeFormat<TRef extends { format: TypeFormat }, TInner> = {
  "?": TInner | null | undefined;
  "?=": TInner | null | undefined;
  "?[]?": (TInner | null | undefined)[] | null | undefined;
  "?[]?=": (TInner | null | undefined)[] | null | undefined;
  "?[]!": (TInner | null | undefined)[];
  "?[]!=": (TInner | null | undefined)[];
  "!": TInner;
  "!=": TInner;
  "![]?": TInner[] | null | undefined;
  "![]?=": TInner[] | null | undefined;
  "![]!": TInner[];
  "![]!=": TInner[];
}[TRef["format"]];

export type ListTypeFormat = { [T in TypeFormat]: T extends `${string}[]${string}` ? T : never }[TypeFormat];
export type OptionalTypeFormat = { [T in TypeFormat]: T extends `${string}${"?" | "="}` ? T : never }[TypeFormat];

export type UnwrapListTypeRef<TRef extends AbstractTypeRef<string>> = TRef extends TRef
  ? {
      kind: TRef["kind"];
      name: TRef["name"];
      format: UnwrapListTypeFormat<TRef["format"]>;
    }
  : never;

export type TypeRefMappingWithFlags<TRefMapping extends { [key: string]: { format: TypeFormat } }> = {
  [K in keyof TRefMapping as TRefMapping[K] extends { format: OptionalTypeFormat } ? never : K]-?: TRefMapping[K];
} & {
  [K in keyof TRefMapping as TRefMapping[K] extends { format: OptionalTypeFormat } ? K : never]+?: TRefMapping[K];
};

export type TypeRef = TypenameRef | ScalarRef | EnumRef | InputTypeRef | ObjectTypeRef | UnionTypeRef;
export type InferrableTypeRef = TypenameRef | ScalarRef | EnumRef;
export type InputDefinition = ScalarRef | EnumRef | InputTypeRef;
export type FieldDefinition = TypenameRef | ScalarRef | EnumRef | ObjectTypeRef | UnionTypeRef;

export type TypenameRef = AbstractTypeRef<"typename">;
export type ScalarRef = AbstractTypeRef<"scalar">;
export type EnumRef = AbstractTypeRef<"enum">;
export type InputTypeRef = AbstractTypeRef<"input">;
export type ObjectTypeRef = AbstractTypeRef<"object">;
export type UnionTypeRef = AbstractTypeRef<"union">;
