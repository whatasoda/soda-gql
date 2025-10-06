import type { Compiler } from "webpack";

export type WatchRunCallback = (args: {
  readonly compiler: Compiler;
  readonly modifiedFiles: ReadonlySet<string> | undefined;
  readonly removedFiles: ReadonlySet<string> | undefined;
}) => Promise<void>;

export type RunCallback = () => Promise<void>;

export type InvalidCallback = (fileName: string, changeTime: number) => void;

export type WatchCloseCallback = () => void | Promise<void>;

type HookOptions = {
  readonly pluginName: string;
  readonly run: RunCallback;
  readonly watchRun: WatchRunCallback;
  readonly onInvalid?: InvalidCallback;
  readonly onWatchClose?: WatchCloseCallback;
};

export const registerCompilerHooks = (compiler: Compiler, options: HookOptions): void => {
  const { pluginName, run, watchRun, onInvalid, onWatchClose } = options;

  compiler.hooks.beforeRun.tapPromise(pluginName, run);
  compiler.hooks.run.tapPromise(pluginName, run);

  compiler.hooks.watchRun.tapPromise(pluginName, (watchCompiler) =>
    watchRun({
      compiler: watchCompiler,
      modifiedFiles: watchCompiler.modifiedFiles,
      removedFiles: watchCompiler.removedFiles,
    }),
  );

  if (onInvalid) {
    compiler.hooks.invalid.tap(pluginName, onInvalid);
  }

  if (onWatchClose) {
    compiler.hooks.watchClose.tap(pluginName, () => {
      void onWatchClose();
    });
  }
};
