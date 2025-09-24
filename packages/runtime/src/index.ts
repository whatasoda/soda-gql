export type RuntimeFactory<TValue> = () => TValue;

export const createModel = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export const createSlice = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export const createOperation = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export type RuntimeModelRegistry<TValue> = Readonly<Record<string, TValue>>;

export type GqlRuntime = {
  readonly model: <TValue>(binding: TValue) => TValue;
  readonly querySlice: <TValue>(binding: TValue) => TValue;
  readonly query: <TValue>(binding: TValue) => TValue;
  readonly handleProjectionBuilder: <TFactory>(factory: TFactory) => TFactory;
};

export const gqlRuntime: GqlRuntime = {
  model: (binding) => binding,
  querySlice: (binding) => binding,
  query: (binding) => binding,
  handleProjectionBuilder: (factory) => factory,
};
