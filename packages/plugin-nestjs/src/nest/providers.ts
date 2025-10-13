import { Inject, Injectable, Logger, type OnModuleInit, type Provider } from "@nestjs/common";
import type { BuilderArtifactModel, BuilderArtifactOperation, BuilderArtifactSlice } from "@soda-gql/builder";
import type { ArtifactProvider } from "@soda-gql/plugin-shared";
import type { NestModuleOptions } from "../schemas/module.js";
import { createNestArtifactProvider } from "../shared/artifact-provider.js";
import {
  SODA_GQL_ARTIFACT,
  SODA_GQL_DIAGNOSTICS,
  SODA_GQL_MODULE_OPTIONS,
  type SodaGqlArtifact,
  type SodaGqlDiagnostics,
} from "./tokens.js";

const ARTIFACT_PROVIDER = Symbol.for("@soda-gql/plugin-nestjs:artifact-provider");

/**
 * Create artifact provider for Nest module.
 * Uses the shared ArtifactProvider abstraction from plugin-shared.
 */
const createArtifactProviderForNest = async (options: NestModuleOptions, logger: Logger): Promise<ArtifactProvider> => {
  try {
    return await createNestArtifactProvider(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.diagnostics !== "off") {
      logger.error(`[@soda-gql/plugin-nestjs] Failed to create artifact provider: ${message}`);
    }
    throw error;
  }
};

export const createSodaGqlArtifactProviders = (): Provider[] => [
  {
    provide: ARTIFACT_PROVIDER,
    useFactory: async (options: NestModuleOptions) => {
      return createArtifactProviderForNest(options, new Logger("SodaGqlModule"));
    },
    inject: [SODA_GQL_MODULE_OPTIONS],
  },
  {
    provide: SODA_GQL_ARTIFACT,
    useFactory: async (provider: ArtifactProvider, options: NestModuleOptions) => {
      const logger = new Logger("SodaGqlModule");
      const shouldLog = options.diagnostics !== "off";

      try {
        const result = await provider.load();

        if (result.isErr()) {
          const error = result.error;
          if (shouldLog) {
            logger.warn(`[@soda-gql/plugin-nestjs] Failed to load artifact: ${error.message}`);
          }
          return null;
        }

        const artifact = result.value;

        if (shouldLog && artifact.report.warnings.length > 0) {
          for (const warning of artifact.report.warnings) {
            logger.warn(`[@soda-gql/plugin-nestjs] ${warning}`);
          }
        }

        return artifact;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldLog) {
          logger.error(`[@soda-gql/plugin-nestjs] Unexpected error loading artifact: ${message}`);
        }
        return null;
      }
    },
    inject: [ARTIFACT_PROVIDER, SODA_GQL_MODULE_OPTIONS],
  },
  {
    provide: SODA_GQL_DIAGNOSTICS,
    useFactory: async (provider: ArtifactProvider, options: NestModuleOptions) => {
      const logger = new Logger("SodaGqlModule");
      const timestamp = new Date();

      try {
        const result = await provider.load();

        if (result.isErr()) {
          const error = result.error;
          return {
            status: "error" as const,
            artifactPath: options.artifactPath,
            timestamp,
            message: error.message,
            code: error.code,
          };
        }

        const artifact = result.value;
        return {
          status: "loaded" as const,
          artifactPath: options.artifactPath,
          loadedAt: timestamp,
          warnings: artifact.report.warnings,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (options.diagnostics !== "off") {
          logger.error(`[@soda-gql/plugin-nestjs] Unexpected error in diagnostics: ${message}`);
        }
        return {
          status: "error" as const,
          artifactPath: options.artifactPath,
          timestamp,
          message,
        };
      }
    },
    inject: [ARTIFACT_PROVIDER, SODA_GQL_MODULE_OPTIONS],
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
