import {
  type AnyGraphqlSchema,
  type MinimalSchema,
  createDirectiveMethod,
  createTypedDirectiveMethod,
  createGqlElementComposer,
  createStandardDirectives,
} from "@soda-gql/core";
import { scalar_default } from "./_internal-injects";
import { enum_default_EmployeeRole, enum_default_ProjectStatus, enum_default_SortOrder, enum_default_TaskPriority } from "./_defs/enums";
import { input_default_BigIntFilter, input_default_BooleanFilter, input_default_CreateProjectInput, input_default_CreateTaskInput, input_default_DateTimeFilter, input_default_DepartmentFilterInput, input_default_EmployeeFilterInput, input_default_EmployeeRoleFilter, input_default_IntFilter, input_default_PaginationInput, input_default_ProjectFilterInput, input_default_ProjectStatusFilter, input_default_SortInput, input_default_StringFilter, input_default_TaskFilterInput, input_default_TaskPriorityFilter, input_default_TeamFilterInput, input_default_TransferEmployeeInput, input_default_UpdateProjectInput, input_default_UpdateTaskInput } from "./_defs/inputs";
import { object_default_Comment, object_default_Company, object_default_Department, object_default_Employee, object_default_Mutation, object_default_Project, object_default_Query, object_default_Subscription, object_default_Task, object_default_Team } from "./_defs/objects";
import { union_default_ActivityItem, union_default_SearchResult } from "./_defs/unions";
import { typeNames_default } from "./_defs/type-names";


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
const enum_default = { EmployeeRole: enum_default_EmployeeRole, ProjectStatus: enum_default_ProjectStatus, SortOrder: enum_default_SortOrder, TaskPriority: enum_default_TaskPriority } as const;
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

// --- MINIMAL SCHEMA (for composer) ---
const minimalSchema_default = {
  label: "default" as const,
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" } as const,
  object: { Comment: object_default_Comment.fields, Company: object_default_Company.fields, Department: object_default_Department.fields, Employee: object_default_Employee.fields, Mutation: object_default_Mutation.fields, Project: object_default_Project.fields, Query: object_default_Query.fields, Subscription: object_default_Subscription.fields, Task: object_default_Task.fields, Team: object_default_Team.fields } as unknown as MinimalSchema["object"],
  union: {
  ActivityItem: ["Comment", "Project", "Task"],
  SearchResult: ["Comment", "Employee", "Project", "Task"],
} as const,
  typeNames: typeNames_default,
} as const satisfies MinimalSchema;

const customDirectives_default = { ...createStandardDirectives(), ...{} };

export type Schema_default = typeof fullSchema_default & { _?: never };
const gql_default = createGqlElementComposer(minimalSchema_default, { directiveMethods: customDirectives_default });
export type Context_default = Parameters<typeof gql_default>[0] extends (ctx: infer C) => unknown ? C : never;
export { minimalSchema_default as __schema_default };
export { fullSchema_default as __fullSchema_default };
export { customDirectives_default as __directiveMethods_default };

export { gql_default as __gql_default };
