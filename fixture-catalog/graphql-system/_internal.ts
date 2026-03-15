import {
  type AnyGraphqlSchema,
  createDirectiveMethod,
  createTypedDirectiveMethod,
  createGqlElementComposer,
  createStandardDirectives,
} from "@soda-gql/core";
import { scalar_default, scalar_admin } from "./_internal-injects";
import { enum_default_CacheScope, enum_default_EmployeeRole, enum_default_LogLevel, enum_default_ProjectStatus, enum_default_SortOrder, enum_default_TaskPriority } from "./_defs/enums";
import { input_default_BigIntFilter, input_default_BooleanFilter, input_default_CreateProjectInput, input_default_CreateTaskInput, input_default_DateTimeFilter, input_default_DepartmentFilterInput, input_default_EmployeeFilterInput, input_default_EmployeeRoleFilter, input_default_IntFilter, input_default_PaginationInput, input_default_ProjectFilterInput, input_default_ProjectStatusFilter, input_default_SortInput, input_default_StringFilter, input_default_TaskFilterInput, input_default_TaskPriorityFilter, input_default_TeamFilterInput, input_default_TransferEmployeeInput, input_default_UpdateProjectInput, input_default_UpdateTaskInput } from "./_defs/inputs";
import { object_default_Comment, object_default_Company, object_default_Department, object_default_Employee, object_default_Mutation, object_default_Project, object_default_Query, object_default_Subscription, object_default_Task, object_default_Team } from "./_defs/objects";
import { union_default_ActivityItem, union_default_SearchResult } from "./_defs/unions";
import { enum_admin_EmployeeRole, enum_admin_ProjectStatus, enum_admin_TaskPriority } from "./_defs/enums";
import { object_admin_Comment, object_admin_Company, object_admin_Department, object_admin_Employee, object_admin_Mutation, object_admin_Project, object_admin_Query, object_admin_Subscription, object_admin_Task, object_admin_Team } from "./_defs/objects";


// Individual scalar definitions
// (scalars imported)

// Individual enum definitions
// (enums imported)

// Individual input definitions
// (inputs imported)

// Individual object definitions
// (objects imported)

// Individual union definitions
// (unions imported)

// Category assembly
// scalar_default is imported directly
const enum_default = { CacheScope: enum_default_CacheScope, EmployeeRole: enum_default_EmployeeRole, LogLevel: enum_default_LogLevel, ProjectStatus: enum_default_ProjectStatus, SortOrder: enum_default_SortOrder, TaskPriority: enum_default_TaskPriority } as const;
const input_default = { BigIntFilter: input_default_BigIntFilter, BooleanFilter: input_default_BooleanFilter, CreateProjectInput: input_default_CreateProjectInput, CreateTaskInput: input_default_CreateTaskInput, DateTimeFilter: input_default_DateTimeFilter, DepartmentFilterInput: input_default_DepartmentFilterInput, EmployeeFilterInput: input_default_EmployeeFilterInput, EmployeeRoleFilter: input_default_EmployeeRoleFilter, IntFilter: input_default_IntFilter, PaginationInput: input_default_PaginationInput, ProjectFilterInput: input_default_ProjectFilterInput, ProjectStatusFilter: input_default_ProjectStatusFilter, SortInput: input_default_SortInput, StringFilter: input_default_StringFilter, TaskFilterInput: input_default_TaskFilterInput, TaskPriorityFilter: input_default_TaskPriorityFilter, TeamFilterInput: input_default_TeamFilterInput, TransferEmployeeInput: input_default_TransferEmployeeInput, UpdateProjectInput: input_default_UpdateProjectInput, UpdateTaskInput: input_default_UpdateTaskInput } as const;
const object_default = { Comment: object_default_Comment, Company: object_default_Company, Department: object_default_Department, Employee: object_default_Employee, Mutation: object_default_Mutation, Project: object_default_Project, Query: object_default_Query, Subscription: object_default_Subscription, Task: object_default_Task, Team: object_default_Team } as const;
const union_default = { ActivityItem: union_default_ActivityItem, SearchResult: union_default_SearchResult } as const;

// --- FULL SCHEMA (for typegen) ---
const fullSchema_default = {
  label: "default" as const,
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" } as const,
  scalar: scalar_default,
  enum: enum_default,
  input: input_default,
  object: object_default,
  union: union_default,
} as const satisfies AnyGraphqlSchema;

const customDirectives_default = { ...createStandardDirectives(), ...{
  auth: createTypedDirectiveMethod("auth", ["FIELD"] as const, {
    role: "s|String|!",
  }),
  cached: createTypedDirectiveMethod("cached", ["FIELD"] as const, {
    scope: "e|CacheScope|?",
    ttl: "s|Int|!",
  }),
  constraint: createTypedDirectiveMethod("constraint", ["VARIABLE_DEFINITION"] as const, {
    max: "s|Int|?",
    min: "s|Int|?",
    pattern: "s|String|?",
  }),
  defer: createTypedDirectiveMethod("defer", ["FRAGMENT_SPREAD","INLINE_FRAGMENT"] as const, {
    if: "s|Boolean|?",
    label: "s|String|?",
  }),
  internal: createDirectiveMethod("internal", ["FIELD","OBJECT"] as const),
  log: createTypedDirectiveMethod("log", ["FIELD","QUERY","MUTATION","SUBSCRIPTION"] as const, {
    level: "e|LogLevel|?",
  }),
  rateLimit: createTypedDirectiveMethod("rateLimit", ["FIELD","QUERY","MUTATION"] as const, {
    duration: "s|Int|!",
    limit: "s|Int|!",
    message: "s|String|?",
  }),
  stream: createTypedDirectiveMethod("stream", ["FIELD"] as const, {
    if: "s|Boolean|?",
    initialCount: "s|Int|?",
    label: "s|String|?",
  }),
  tag: createTypedDirectiveMethod("tag", ["FIELD","OBJECT","INTERFACE"] as const, {
    name: "s|String|!",
  }),
} };

export type Schema_default = typeof fullSchema_default & { _?: never };
const gql_default = createGqlElementComposer(fullSchema_default, { directiveMethods: customDirectives_default });
export type Context_default = Parameters<typeof gql_default>[0] extends (ctx: infer C) => unknown ? C : never;
export { fullSchema_default as __schema_default };
export { fullSchema_default as __fullSchema_default };
export { customDirectives_default as __directiveMethods_default };

// Individual scalar definitions
// (scalars imported)

// Individual enum definitions
// (enums imported)

// Individual input definitions
// (inputs imported)

// Individual object definitions
// (objects imported)

// Individual union definitions
// (unions imported)

// Category assembly
// scalar_admin is imported directly
const enum_admin = { EmployeeRole: enum_admin_EmployeeRole, ProjectStatus: enum_admin_ProjectStatus, TaskPriority: enum_admin_TaskPriority } as const;
const input_admin = {} as const;
const object_admin = { Comment: object_admin_Comment, Company: object_admin_Company, Department: object_admin_Department, Employee: object_admin_Employee, Mutation: object_admin_Mutation, Project: object_admin_Project, Query: object_admin_Query, Subscription: object_admin_Subscription, Task: object_admin_Task, Team: object_admin_Team } as const;
const union_admin = {} as const;

// --- FULL SCHEMA (for typegen) ---
const fullSchema_admin = {
  label: "admin" as const,
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" } as const,
  scalar: scalar_admin,
  enum: enum_admin,
  input: input_admin,
  object: object_admin,
  union: union_admin,
} as const satisfies AnyGraphqlSchema;

const customDirectives_admin = { ...createStandardDirectives(), ...{} };

export type Schema_admin = typeof fullSchema_admin & { _?: never };
const gql_admin = createGqlElementComposer(fullSchema_admin, { directiveMethods: customDirectives_admin });
export type Context_admin = Parameters<typeof gql_admin>[0] extends (ctx: infer C) => unknown ? C : never;
export { fullSchema_admin as __schema_admin };
export { fullSchema_admin as __fullSchema_admin };
export { customDirectives_admin as __directiveMethods_admin };

export { gql_default as __gql_default };
export { gql_admin as __gql_admin };
