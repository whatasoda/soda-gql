import { type DynamicModule, Module } from "@nestjs/common";
import type { NestModuleOptions } from "../schemas/module.js";
import { nestModuleOptionsSchema } from "../schemas/module.js";
import { createSodaGqlArtifactProviders, SodaGqlService } from "./providers.js";
import { SODA_GQL_ARTIFACT, SODA_GQL_DIAGNOSTICS, SODA_GQL_MODULE_OPTIONS } from "./tokens.js";

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS requires class for @Module decorator
export class SodaGqlModule {
  static forRoot(options: NestModuleOptions): DynamicModule {
    const parsedOptions = nestModuleOptionsSchema.parse(options);
    const artifactProviders = createSodaGqlArtifactProviders();

    return {
      module: SodaGqlModule,
      providers: [{ provide: SODA_GQL_MODULE_OPTIONS, useValue: parsedOptions }, ...artifactProviders, SodaGqlService],
      exports: [SodaGqlService, SODA_GQL_ARTIFACT, SODA_GQL_DIAGNOSTICS],
    };
  }
}
