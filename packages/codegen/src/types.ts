import type { Result } from "neverthrow";

export type CodegenFormat = "json" | "human";

// Inject configuration per schema (always resolved object form)
export type CodegenInjectConfig = {
  readonly scalars: string;
  readonly adapter?: string;
};

// Schema configuration for codegen (mirrors config structure)
export type CodegenSchemaConfig = {
  readonly schema: string;
  readonly inject: CodegenInjectConfig;
};

export type CodegenOptions = {
  readonly schemas: Record<string, CodegenSchemaConfig>;
  readonly outPath: string;
  readonly format: CodegenFormat;
  readonly importExtension?: boolean;
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
