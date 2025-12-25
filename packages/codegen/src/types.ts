import type { Result } from "neverthrow";

export type CodegenFormat = "json" | "human";

export type CodegenOptions = {
  readonly schemaPath: string;
  readonly outPath: string;
  readonly format: CodegenFormat;
  readonly injectFromPath: string;
};

// Inject configuration per schema (always resolved object form)
export type CodegenInjectConfig = {
  readonly scalars: string;
  readonly helpers?: string;
  readonly metadata?: string;
};

export type MultiSchemaCodegenOptions = {
  readonly schemas: Record<string, string>; // name -> path
  readonly outPath: string;
  readonly format: CodegenFormat;
  readonly inject?: Record<string, CodegenInjectConfig>; // schema name -> inject config
  readonly injectFromPath?: string; // Legacy: single inject module for default schema
  readonly importExtension?: boolean; // Whether to include file extensions in import paths (default: false)
};

export type CodegenCliCommand =
  | {
      readonly kind: "generate";
      readonly options: CodegenOptions;
    }
  | {
      readonly kind: "emitInjectTemplate";
      readonly outPath: string;
      readonly format: CodegenFormat;
    };

export type CodegenError =
  | {
      readonly code: "SCHEMA_NOT_FOUND";
      readonly message: string;
      readonly schemaPath: string;
    }
  | {
      readonly code: "SCHEMA_INVALID";
      readonly message: string;
      readonly schemaPath: string;
    }
  | {
      readonly code: "EMIT_FAILED";
      readonly message: string;
      readonly outPath: string;
    }
  | {
      readonly code: "INJECT_MODULE_REQUIRED";
      readonly message: string;
    }
  | {
      readonly code: "INJECT_MODULE_NOT_FOUND";
      readonly message: string;
      readonly injectPath: string;
    }
  | {
      readonly code: "INJECT_TEMPLATE_EXISTS";
      readonly message: string;
      readonly outPath: string;
    }
  | {
      readonly code: "INJECT_TEMPLATE_FAILED";
      readonly message: string;
      readonly outPath: string;
    };

export type CodegenSuccess = {
  readonly schemaHash: string;
  readonly outPath: string;
  readonly objects: number;
  readonly enums: number;
  readonly inputs: number;
  readonly unions: number;
};

export type MultiSchemaCodegenSuccess = {
  readonly schemas: Record<
    string,
    {
      readonly schemaHash: string;
      readonly objects: number;
      readonly enums: number;
      readonly inputs: number;
      readonly unions: number;
    }
  >;
  readonly outPath: string;
  readonly cjsPath: string;
};

export type CodegenResult = Result<CodegenSuccess, CodegenError>;
export type MultiSchemaCodegenResult = Result<MultiSchemaCodegenSuccess, CodegenError>;
