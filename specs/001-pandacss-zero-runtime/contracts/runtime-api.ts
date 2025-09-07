/**
 * Runtime API Contract for Zero-runtime GraphQL Generation
 * This defines the public API that developers use in their application code
 * 
 * Note: Subscriptions support is currently out of scope and would be a runtime-only extension.
 * Directives and fragments are not supported in favor of higher-level abstractions.
 */

import { z } from 'zod';

// ============================================================================
// Generated Schema Types (imported from generated code)
// ============================================================================

/**
 * These interfaces are generated from GraphQL schema
 * Users import via: import { gql } from '@/graphql-system';
 * All schema types are accessible through the generated system
 */

// GraphQL Object Types (User, Post, etc.)
export interface SchemaTypes {
  [typeName: string]: any;
}

// GraphQL Input Types (CreateUserInput, UpdatePostInput, etc.)
export interface SchemaInputTypes {
  [inputName: string]: any;
}

// GraphQL Scalar Types (ID, String, Int, Float, Boolean, custom scalars)
export interface SchemaScalarTypes {
  ID: string;
  String: string;
  Int: number;
  Float: number;
  Boolean: boolean;
  [scalarName: string]: any;
}

// GraphQL Enum Types (Status, Role, etc.)
export interface SchemaEnumTypes {
  [enumName: string]: string;
}

// Combined schema interface for convenience
export interface GeneratedSchema {
  types: SchemaTypes;
  inputs: SchemaInputTypes;
  scalars: SchemaScalarTypes;
  enums: SchemaEnumTypes;
  Query: SchemaTypes['Query'];
  Mutation: SchemaTypes['Mutation'];
}

// ============================================================================
// Remote Model API
// ============================================================================

/**
 * Field selection for GraphQL types with proper type inference
 */
export type FieldSelection<T = any> = {
  [K in keyof T]?: T[K] extends object ? boolean | FieldSelection<T[K]> : boolean;
};

/**
 * Transform function for normalizing data
 */
export type TransformFunction<TInput = any, TOutput = any> = (
  data: TInput
) => TOutput;

/**
 * Parameter definition for parameterized fragments
 */
export interface Parameter<T = any> {
  name: string;
  type: T;
  required?: boolean;
  defaultValue?: T;
}

/**
 * Remote Model definition
 */
export interface RemoteModel<TType = any, TTransformed = any, TParams = {}> {
  /**
   * Internal type brand
   */
  readonly _type: TType;
  readonly _transformed: TTransformed;
  readonly _params: TParams;
  
  /**
   * GraphQL type name
   */
  typeName: string;
  
  /**
   * Field selection
   */
  fields: FieldSelection<TType>;
  
  /**
   * Transform function
   */
  transform: TransformFunction<TType, TTransformed>;
  
  /**
   * Parameters for this model
   */
  parameters?: TParams;
}

/**
 * Remote Model creation function
 */
export interface ModelFunction {
  // Simple form without parameters
  <TType extends keyof SchemaTypes, TTransformed>(
    typeName: TType,
    fields: (relation: RelationFunction<SchemaTypes[TType]>) => FieldSelection<SchemaTypes[TType]>,
    transform: TransformFunction<NoInfer<SchemaTypes[TType]>, TTransformed>
  ): RemoteModel<SchemaTypes[TType], TTransformed, {}>;
  
  // Complex form with parameters
  <TType extends keyof SchemaTypes, TTransformed, TParams>(
    definition: [TType, TParams],
    fields: (relation: RelationFunction<SchemaTypes[TType]>, args: NoInfer<TParams>) => FieldSelection<SchemaTypes[TType]>,
    transform: TransformFunction<NoInfer<SchemaTypes[TType]>, TTransformed>
  ): RemoteModel<SchemaTypes[TType], TTransformed, TParams>;
}

/**
 * Relation function for nested selections in models
 * Type parameter TContext provides proper field suggestions
 */
export interface RelationFunction<TContext = any> {
  // Select a related field with a model
  <TField extends keyof TContext, TModel extends RemoteModel>(
    field: TField,
    model: NoInfer<TModel>
  ): TModel['_transformed'];
  
  // Select a related field with arguments and model
  <TField extends keyof TContext, TModel extends RemoteModel, TArgs>(
    definition: [TField, TArgs],
    model: NoInfer<TModel> | [NoInfer<TModel>, FieldSelection<any>]
  ): TModel['_transformed'];
}

/**
 * Input parameter helpers for models
 */
export interface InputHelpers {
  fromQuery(
    path: string,
    options: {
      prefix?: string;
      pick?: Record<string, boolean>;
      omit?: Record<string, boolean>;
    }
  ): any;
}

// ============================================================================
// Query/Mutation/Subscription Slice API
// ============================================================================

/**
 * Argument definition
 */
export interface Argument<T = any> {
  name: string;
  type: T;
  required?: boolean;
  defaultValue?: T;
}

/**
 * Slice selection builder with type-safe field names
 */
export interface SelectionBuilder<TContext extends keyof SchemaTypes = 'Query'> {
  /**
   * Select a field with a remote model
   */
  <TField extends keyof SchemaTypes[TContext], TModel extends RemoteModel>(
    field: TField,
    model: NoInfer<TModel>
  ): TModel['_transformed'];
  
  /**
   * Select a field with arguments and model (tuple syntax)
   */
  <TField extends keyof SchemaTypes[TContext], TModel extends RemoteModel, TArgs>(
    definition: [TField, NoInfer<TArgs>],
    model: NoInfer<TModel>
  ): TModel['_transformed'];
}

/**
 * Query Slice definition
 */
export interface QuerySlice<TData = any, TArgs = any> {
  readonly _data: TData;
  readonly _args: TArgs;
  
  name: string;
  selections: (query: SelectionBuilder, args: TArgs) => TData;
  transform: TransformFunction<any, TData>;
}

/**
 * Mutation Slice definition
 */
export interface MutationSlice<TData = any, TArgs = any> {
  readonly _data: TData;
  readonly _args: TArgs;
  
  name: string;
  selections: (mutate: SelectionBuilder, args: TArgs) => TData;
  transform: TransformFunction<any, TData>;
}

/**
 * Subscription Slice definition
 */
export interface SubscriptionSlice<TData = any, TArgs = any> {
  readonly _data: TData;
  readonly _args: TArgs;
  
  name: string;
  selections: (subscribe: SelectionBuilder, args: TArgs) => TData;
  transform: TransformFunction<any, TData>;
}

/**
 * Slice creation functions
 */
export interface QuerySliceFunction {
  // Simple form without arguments
  <TData>(
    name: string,
    selections: (query: SelectionBuilder) => TData,
    transform?: TransformFunction<any, TData>
  ): QuerySlice<TData, {}>;
  
  // Form with arguments using tuple syntax
  <TData, TArgs>(
    definition: [string, TArgs],
    selections: (query: SelectionBuilder, args: TArgs) => TData,
    transform?: TransformFunction<any, TData>
  ): QuerySlice<TData, TArgs>;
}

export interface MutationSliceFunction {
  // Simple form without arguments
  <TData>(
    name: string,
    selections: (mutate: SelectionBuilder) => TData,
    transform?: TransformFunction<any, TData>
  ): MutationSlice<TData, {}>;
  
  // Form with arguments using tuple syntax
  <TData, TArgs>(
    definition: [string, TArgs],
    selections: (mutate: SelectionBuilder, args: TArgs) => TData,
    transform?: TransformFunction<any, TData>
  ): MutationSlice<TData, TArgs>;
}

// ============================================================================
// Page Query API
// ============================================================================

/**
 * Slice reference in a page query
 */
export interface SliceReference<TSlice = any> {
  slice: TSlice;
  args?: any;
}

/**
 * Page Query definition
 */
export interface PageQuery<TData = any, TVariables = any> {
  readonly _data: TData;
  readonly _variables: TVariables;
  
  name: string;
  slices: SliceReference[];
  document?: string; // Generated at build time
  registrationId?: symbol; // Assigned at registration
}

/**
 * Page Query builder
 */
export interface QueryBuilder<TContext = any> {
  /**
   * Add a query slice
   */
  <TSlice extends QuerySlice>(
    slice: TSlice,
    args?: TSlice['_args']
  ): TSlice['_data'];
  
  /**
   * Add multiple slices
   */
  combine<TSlices extends QuerySlice[]>(
    ...slices: TSlices
  ): { [K in keyof TSlices]: TSlices[K]['_data'] };
}

/**
 * Page Query creation function
 */
export interface QueryFunction {
  <TData, TVariables = {}>(
    definition: [string, TVariables],
    builder: (query: QueryBuilder, vars: TVariables) => TData
  ): PageQuery<TData, TVariables>;
}

export interface MutationFunction {
  <TData, TVariables = {}>(
    definition: [string, TVariables],
    builder: (mutate: QueryBuilder, vars: TVariables) => TData
  ): PageQuery<TData, TVariables>;
}

// ============================================================================
// Argument Type Definitions
// ============================================================================

export interface ArgTypes {
  // Scalar types
  string(): SchemaScalarTypes['String'];
  int(): SchemaScalarTypes['Int'];
  float(): SchemaScalarTypes['Float'];
  boolean(): SchemaScalarTypes['Boolean'];
  id(): SchemaScalarTypes['ID'];
  
  // Custom scalars
  scalar<K extends keyof SchemaScalarTypes>(name: K): SchemaScalarTypes[K];
  
  // Enum types
  enum<K extends keyof SchemaEnumTypes>(name: K): SchemaEnumTypes[K];
  
  // Input types
  input<K extends keyof SchemaInputTypes>(name: K): SchemaInputTypes[K];
  
  // Modifiers
  array<T>(type: NoInfer<T>): T[];
  nullable<T>(type: NoInfer<T>): T | null;
  required<T>(type: NoInfer<T>): NonNullable<T>;
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Infer the output type of a Remote Model
 */
export type InferModel<T> = T extends RemoteModel<any, infer TTransformed, any>
  ? TTransformed
  : never;

/**
 * Infer the data type of a Query Slice
 */
export type InferSlice<T> = T extends QuerySlice<infer TData, any>
  ? TData
  : T extends MutationSlice<infer TData, any>
  ? TData
  : T extends SubscriptionSlice<infer TData, any>
  ? TData
  : never;

/**
 * Infer the data type of a Page Query
 */
export type InferQuery<T> = T extends PageQuery<infer TData, any>
  ? TData
  : never;

/**
 * Infer the variables type of a Page Query
 */
export type InferVariables<T> = T extends PageQuery<any, infer TVariables>
  ? TVariables
  : never;

// ============================================================================
// Main GQL API
// ============================================================================

export interface GqlApi {
  /**
   * Create a remote model
   */
  model: ModelFunction;
  
  /**
   * Create a query slice
   */
  querySlice: QuerySliceFunction;
  
  /**
   * Create a mutation slice
   */
  mutationSlice: MutationSliceFunction;
  
  /**
   * Create a page query
   */
  query: QueryFunction;
  
  /**
   * Create a page mutation
   */
  mutation: MutationFunction;
  
  /**
   * Argument type helpers with proper type inference
   */
  arg: ArgTypes;
  
  /**
   * Input parameter helpers for models
   */
  input: InputHelpers;
  
  /**
   * Type inference utility
   */
  infer: <T>(model: T) => InferModel<T> | InferSlice<T> | InferQuery<T>;
}

// ============================================================================
// Registration API (Internal, used by generated code)
// ============================================================================

export interface RegistrationOptions {
  document: string;
  transforms: Map<string, TransformFunction>;
  checksum: string;
}

export interface RegisterFunction {
  (options: RegistrationOptions): symbol;
}

export interface RegistryApi {
  /**
   * Register a generated query document
   */
  register: RegisterFunction;
  
  /**
   * Get a registered document by ID
   */
  get(id: symbol): RegistrationOptions | undefined;
  
  /**
   * Clear all registrations (for testing)
   */
  clear(): void;
}