export type RuntimeFactory<TValue> = () => TValue;

export const createModel = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export const createSlice = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export const createOperation = <TValue>(id: string, factory: RuntimeFactory<TValue>): TValue => factory();

export type RuntimeModelRegistry<TValue> = Readonly<Record<string, TValue>>;
