import { z } from "zod";

// biome-ignore lint/suspicious/noExplicitAny: abstract type
export type SchemaFor<TOutput> = z.ZodType<TOutput, any, any>;

export type ShapeFor<TOutput extends object> = { [K in keyof TOutput]-?: SchemaFor<TOutput[K]> };

export function defineSchemaFor<TOutput extends object>() {
  return <TShape extends ShapeFor<NoInfer<TOutput>>>(shape: TShape & { [K in Exclude<keyof TShape, keyof TOutput>]: never }) =>
    z.object(shape).strict();
}
