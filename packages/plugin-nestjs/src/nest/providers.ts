import { Inject, Injectable, Logger, type OnModuleInit, type Provider } from "@nestjs/common";
import type { BuilderArtifactModel, BuilderArtifactOperation, BuilderArtifactSlice } from "@soda-gql/builder";
import { loadArtifact } from "@soda-gql/plugin-shared";
import type { NestModuleOptions } from "../schemas/module.js";
import {
  SODA_GQL_ARTIFACT,
  SODA_GQL_DIAGNOSTICS,
  SODA_GQL_MODULE_OPTIONS,
  type SodaGqlArtifact,
  type SodaGqlDiagnostics,
} from "./tokens.js";

const ARTIFACT_LOADER = Symbol.for("@soda-gql/plugin-nestjs:artifact-loader");

type ArtifactLoadResult = {
  readonly artifact: SodaGqlArtifact;
  readonly diagnostics: SodaGqlDiagnostics;
};

type ArtifactLoader = () => Promise<ArtifactLoadResult>;

const createArtifactLoader = (options: NestModuleOptions, logger: Logger): ArtifactLoader => {
  let cached: Promise<ArtifactLoadResult> | null = null;
  const shouldLog = options.diagnostics !== "off";

  const logWarning = (message: string) => {
    if (shouldLog) {
      logger.warn(`[@soda-gql/plugin-nestjs] ${message}`);
    }
  };

  const load = async (): Promise<ArtifactLoadResult> => {
    const timestamp = new Date();
    const artifactPath = options.artifactPath;

    if (!artifactPath || artifactPath.trim().length === 0) {
      const message = "Artifact path is empty; provide a valid path in NestModuleOptions.artifactPath.";
      logWarning(message);
      return {
        artifact: null,
        diagnostics: {
          status: "error",
          artifactPath: artifactPath ?? "",
          timestamp,
          message,
        },
      };
    }

    try {
      const result = await loadArtifact(artifactPath);

      if (result.isErr()) {
        const error = result.error;
        logWarning(`Failed to load artifact at ${artifactPath} (${error.code}): ${error.message}`);
        return {
          artifact: null,
          diagnostics: {
            status: "error",
            artifactPath,
            timestamp,
            message: error.message,
            code: error.code,
          },
        };
      }

      const artifact = result.value;

      if (shouldLog && artifact.report.warnings.length > 0) {
        for (const warning of artifact.report.warnings) {
          logger.warn(`[@soda-gql/plugin-nestjs] ${warning}`);
        }
      }

      return {
        artifact,
        diagnostics: {
          status: "loaded",
          artifactPath,
          loadedAt: timestamp,
          warnings: artifact.report.warnings,
        },
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      logWarning(`Unexpected error while loading artifact at ${artifactPath}: ${message}`);
      return {
        artifact: null,
        diagnostics: {
          status: "error",
          artifactPath,
          timestamp,
          message,
        },
      };
    }
  };

  return () => {
    if (!cached) {
      cached = load();
    }
    return cached;
  };
};

export const createSodaGqlArtifactProviders = (): Provider[] => [
  {
    provide: ARTIFACT_LOADER,
    useFactory: (options: NestModuleOptions) => createArtifactLoader(options, new Logger("SodaGqlModule")),
    inject: [SODA_GQL_MODULE_OPTIONS],
  },
  {
    provide: SODA_GQL_ARTIFACT,
    useFactory: async (loader: ArtifactLoader) => {
      const { artifact } = await loader();
      return artifact;
    },
    inject: [ARTIFACT_LOADER],
  },
  {
    provide: SODA_GQL_DIAGNOSTICS,
    useFactory: async (loader: ArtifactLoader) => {
      const { diagnostics } = await loader();
      return diagnostics;
    },
    inject: [ARTIFACT_LOADER],
  },
];

interface ArtifactIndex {
  readonly operations: BuilderArtifactOperation[];
  readonly operationsByName: Map<string, BuilderArtifactOperation>;
  readonly operationsById: Map<string, BuilderArtifactOperation>;
  readonly slices: BuilderArtifactSlice[];
  readonly slicesById: Map<string, BuilderArtifactSlice>;
  readonly models: BuilderArtifactModel[];
  readonly modelsByTypename: Map<string, BuilderArtifactModel>;
}

const createEmptyIndex = (): ArtifactIndex => ({
  operations: [],
  operationsByName: new Map(),
  operationsById: new Map(),
  slices: [],
  slicesById: new Map(),
  models: [],
  modelsByTypename: new Map(),
});

@Injectable()
export class SodaGqlService implements OnModuleInit {
  private readonly logger = new Logger("SodaGqlService");
  private index: ArtifactIndex | null = null;
  private warnedMissingArtifact = false;

  constructor(
    @Inject(SODA_GQL_MODULE_OPTIONS) private readonly options: NestModuleOptions,
    @Inject(SODA_GQL_ARTIFACT) private readonly artifact: SodaGqlArtifact,
    @Inject(SODA_GQL_DIAGNOSTICS) private readonly diagnostics: SodaGqlDiagnostics,
  ) {}

  onModuleInit(): void {
    if (this.options.eagerRegistration) {
      this.ensureRegistered();
    }
  }

  ensureRegistered(): void {
    this.ensureIndex();
  }

  getOptions(): NestModuleOptions {
    return this.options;
  }

  getDiagnostics(): SodaGqlDiagnostics {
    return this.diagnostics;
  }

  getArtifact(): SodaGqlArtifact {
    return this.artifact;
  }

  hasArtifact(): boolean {
    return this.artifact !== null;
  }

  listOperations(): BuilderArtifactOperation[] {
    const { operations } = this.getIndex();
    return [...operations];
  }

  getOperationByName(operationName: string): BuilderArtifactOperation | null {
    const { operationsByName } = this.getIndex();
    return operationsByName.get(operationName) ?? null;
  }

  getOperationById(canonicalId: string): BuilderArtifactOperation | null {
    const { operationsById } = this.getIndex();
    return operationsById.get(canonicalId) ?? null;
  }

  listSlices(): BuilderArtifactSlice[] {
    const { slices } = this.getIndex();
    return [...slices];
  }

  getSliceById(canonicalId: string): BuilderArtifactSlice | null {
    const { slicesById } = this.getIndex();
    return slicesById.get(canonicalId) ?? null;
  }

  listModels(): BuilderArtifactModel[] {
    const { models } = this.getIndex();
    return [...models];
  }

  getModelByTypename(typename: string): BuilderArtifactModel | null {
    const { modelsByTypename } = this.getIndex();
    return modelsByTypename.get(typename) ?? null;
  }

  private getIndex(): ArtifactIndex {
    this.ensureIndex();
    // biome-ignore lint/style/noNonNullAssertion: ensureIndex guarantees index is set
    return this.index!;
  }

  private ensureIndex(): void {
    if (this.index) {
      return;
    }

    if (!this.artifact) {
      if (!this.warnedMissingArtifact && this.options.diagnostics !== "off") {
        this.logger.warn(
          `[@soda-gql/plugin-nestjs] No artifact loaded from ${this.options.artifactPath}; returning empty Soda GQL registry.`,
        );
      }
      this.warnedMissingArtifact = true;
      this.index = createEmptyIndex();
      return;
    }

    const operations: BuilderArtifactOperation[] = [];
    const operationsByName = new Map<string, BuilderArtifactOperation>();
    const operationsById = new Map<string, BuilderArtifactOperation>();
    const slices: BuilderArtifactSlice[] = [];
    const slicesById = new Map<string, BuilderArtifactSlice>();
    const models: BuilderArtifactModel[] = [];
    const modelsByTypename = new Map<string, BuilderArtifactModel>();

    for (const element of Object.values(this.artifact.elements)) {
      switch (element.type) {
        case "operation": {
          operations.push(element);
          operationsByName.set(element.prebuild.operationName, element);
          operationsById.set(element.id, element);
          break;
        }
        case "slice": {
          slices.push(element);
          slicesById.set(element.id, element);
          break;
        }
        case "model": {
          models.push(element);
          modelsByTypename.set(element.prebuild.typename, element);
          break;
        }
      }
    }

    this.index = {
      operations,
      operationsByName,
      operationsById,
      slices,
      slicesById,
      models,
      modelsByTypename,
    };
  }
}
