import type { WebpackLoaderOptions } from "@soda-gql/plugin-nestjs/schemas/webpack";
import type { LoaderDefinitionFunction } from "webpack";

type LoaderContext = {
  resourcePath: string;
  rootContext?: string;
  sourceMap?: boolean;
  cacheable: (flag: boolean) => void;
  addDependency: (file: string) => void;
  async: () => (err: Error | null, content?: string, sourceMap?: any) => void;
  getOptions: () => WebpackLoaderOptions;
};

type RunLoaderOptions = {
  loader: LoaderDefinitionFunction<WebpackLoaderOptions>;
  resourcePath: string;
  source: string;
  options: WebpackLoaderOptions;
  rootContext?: string;
  sourceMap?: any;
};

type LoaderResult = {
  code: string;
  map?: any;
  error?: Error;
};

/**
 * Run webpack loader in test environment
 */
export const runLoader = async (opts: RunLoaderOptions): Promise<LoaderResult> => {
  return new Promise((resolve) => {
    const context: LoaderContext = {
      resourcePath: opts.resourcePath,
      rootContext: opts.rootContext ?? process.cwd(),
      sourceMap: opts.sourceMap !== undefined,
      cacheable: () => {},
      addDependency: () => {},
      async: () => (err, content, sourceMap) => {
        if (err) {
          resolve({ code: "", error: err });
        } else {
          resolve({ code: content ?? "", map: sourceMap });
        }
      },
      getOptions: () => opts.options,
    };

    // Call loader with context binding
    opts.loader.call(context as any, opts.source, opts.sourceMap);
  });
};
