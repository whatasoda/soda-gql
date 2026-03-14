"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// playgrounds/expo-metro/src/graphql-system/index.ts
var index_exports = {};
__export(index_exports, {
  __directiveMethods_default: () => customDirectives_default,
  __fullSchema_default: () => fullSchema_default,
  __gql_default: () => gql_default,
  __schema_default: () => minimalSchema_default,
  gql: () => gql
});
module.exports = __toCommonJS(index_exports);

// playgrounds/expo-metro/scalars.ts
var import_core = require("@soda-gql/core");
var scalar = {
  // Built-in scalars
  ...(0, import_core.defineScalar)("ID"),
  ...(0, import_core.defineScalar)("String"),
  ...(0, import_core.defineScalar)("Int"),
  ...(0, import_core.defineScalar)("Float"),
  ...(0, import_core.defineScalar)("Boolean"),
  // Custom scalars from schema.graphql
  ...(0, import_core.defineScalar)("DateTime"),
  ...(0, import_core.defineScalar)("JSON"),
  ...(0, import_core.defineScalar)("BigInt")
};

// playgrounds/expo-metro/src/graphql-system/_defs/enums.ts
var import_core2 = require("@soda-gql/core");
var enum_default_EmployeeRole = (0, import_core2.defineEnum)("EmployeeRole", { DIRECTOR: true, ENGINEER: true, EXECUTIVE: true, INTERN: true, MANAGER: true });
var enum_default_ProjectStatus = (0, import_core2.defineEnum)("ProjectStatus", { CANCELLED: true, COMPLETED: true, IN_PROGRESS: true, ON_HOLD: true, PLANNING: true });
var enum_default_SortOrder = (0, import_core2.defineEnum)("SortOrder", { ASC: true, DESC: true });
var enum_default_TaskPriority = (0, import_core2.defineEnum)("TaskPriority", { HIGH: true, LOW: true, MEDIUM: true, URGENT: true });

// playgrounds/expo-metro/src/graphql-system/_defs/inputs.ts
var input_default_BigIntFilter = { name: "BigIntFilter", fields: {
  _eq: "s|BigInt|?",
  _gt: "s|BigInt|?",
  _gte: "s|BigInt|?",
  _lt: "s|BigInt|?",
  _lte: "s|BigInt|?",
  _neq: "s|BigInt|?"
} };
var input_default_BooleanFilter = { name: "BooleanFilter", fields: {
  _eq: "s|Boolean|?"
} };
var input_default_CreateProjectInput = { name: "CreateProjectInput", fields: {
  assigneeIds: "s|ID|![]?",
  description: "s|String|?",
  priority: "s|Int|?",
  status: "e|ProjectStatus|?",
  tasks: "i|CreateTaskInput|![]?",
  teamId: "s|ID|!",
  title: "s|String|!"
} };
var input_default_CreateTaskInput = { name: "CreateTaskInput", fields: {
  assigneeId: "s|ID|?",
  dueDate: "s|DateTime|?",
  estimatedHours: "s|Float|?",
  priority: "e|TaskPriority|?",
  title: "s|String|!"
} };
var input_default_DateTimeFilter = { name: "DateTimeFilter", fields: {
  _eq: "s|DateTime|?",
  _gt: "s|DateTime|?",
  _gte: "s|DateTime|?",
  _lt: "s|DateTime|?",
  _lte: "s|DateTime|?",
  _neq: "s|DateTime|?"
} };
var input_default_DepartmentFilterInput = { name: "DepartmentFilterInput", fields: {
  budget: "i|BigIntFilter|?",
  name: "i|StringFilter|?"
} };
var input_default_EmployeeFilterInput = { name: "EmployeeFilterInput", fields: {
  _and: "i|EmployeeFilterInput|![]?",
  _not: "i|EmployeeFilterInput|?",
  _or: "i|EmployeeFilterInput|![]?",
  department: "i|DepartmentFilterInput|?",
  email: "i|StringFilter|?",
  name: "i|StringFilter|?",
  role: "i|EmployeeRoleFilter|?"
} };
var input_default_EmployeeRoleFilter = { name: "EmployeeRoleFilter", fields: {
  _eq: "e|EmployeeRole|?",
  _in: "e|EmployeeRole|![]?",
  _neq: "e|EmployeeRole|?",
  _nin: "e|EmployeeRole|![]?"
} };
var input_default_IntFilter = { name: "IntFilter", fields: {
  _eq: "s|Int|?",
  _gt: "s|Int|?",
  _gte: "s|Int|?",
  _in: "s|Int|![]?",
  _lt: "s|Int|?",
  _lte: "s|Int|?",
  _neq: "s|Int|?",
  _nin: "s|Int|![]?"
} };
var input_default_PaginationInput = { name: "PaginationInput", fields: {
  cursor: "s|ID|?",
  limit: "s|Int|?",
  offset: "s|Int|?"
} };
var input_default_ProjectFilterInput = { name: "ProjectFilterInput", fields: {
  _and: "i|ProjectFilterInput|![]?",
  _not: "i|ProjectFilterInput|?",
  _or: "i|ProjectFilterInput|![]?",
  createdAt: "i|DateTimeFilter|?",
  priority: "i|IntFilter|?",
  status: "i|ProjectStatusFilter|?",
  team: "i|TeamFilterInput|?",
  title: "i|StringFilter|?"
} };
var input_default_ProjectStatusFilter = { name: "ProjectStatusFilter", fields: {
  _eq: "e|ProjectStatus|?",
  _in: "e|ProjectStatus|![]?",
  _neq: "e|ProjectStatus|?",
  _nin: "e|ProjectStatus|![]?"
} };
var input_default_SortInput = { name: "SortInput", fields: {
  field: "s|String|!",
  order: "e|SortOrder|?"
} };
var input_default_StringFilter = { name: "StringFilter", fields: {
  _contains: "s|String|?",
  _endsWith: "s|String|?",
  _eq: "s|String|?",
  _in: "s|String|![]?",
  _neq: "s|String|?",
  _nin: "s|String|![]?",
  _startsWith: "s|String|?"
} };
var input_default_TaskFilterInput = { name: "TaskFilterInput", fields: {
  _and: "i|TaskFilterInput|![]?",
  _not: "i|TaskFilterInput|?",
  _or: "i|TaskFilterInput|![]?",
  completed: "i|BooleanFilter|?",
  dueDate: "i|DateTimeFilter|?",
  priority: "i|TaskPriorityFilter|?",
  project: "i|ProjectFilterInput|?",
  title: "i|StringFilter|?"
} };
var input_default_TaskPriorityFilter = { name: "TaskPriorityFilter", fields: {
  _eq: "e|TaskPriority|?",
  _in: "e|TaskPriority|![]?",
  _neq: "e|TaskPriority|?",
  _nin: "e|TaskPriority|![]?"
} };
var input_default_TeamFilterInput = { name: "TeamFilterInput", fields: {
  department: "i|DepartmentFilterInput|?",
  name: "i|StringFilter|?"
} };
var input_default_TransferEmployeeInput = { name: "TransferEmployeeInput", fields: {
  departmentId: "s|ID|!",
  employeeId: "s|ID|!",
  newRole: "e|EmployeeRole|?",
  teamId: "s|ID|?"
} };
var input_default_UpdateProjectInput = { name: "UpdateProjectInput", fields: {
  description: "s|String|?",
  priority: "s|Int|?",
  status: "e|ProjectStatus|?",
  title: "s|String|?"
} };
var input_default_UpdateTaskInput = { name: "UpdateTaskInput", fields: {
  assigneeId: "s|ID|?",
  completed: "s|Boolean|?",
  dueDate: "s|DateTime|?",
  estimatedHours: "s|Float|?",
  priority: "e|TaskPriority|?",
  title: "s|String|?"
} };

// playgrounds/expo-metro/src/graphql-system/_defs/objects.ts
var object_default_Comment = { name: "Comment", fields: {
  author: { spec: "o|Employee|!", arguments: {} },
  body: { spec: "s|String|!", arguments: {} },
  createdAt: { spec: "s|DateTime|!", arguments: {} },
  id: { spec: "s|ID|!", arguments: {} },
  parent: { spec: "o|Comment|?", arguments: {} },
  replies: { spec: "o|Comment|![]!", arguments: { limit: "s|Int|?" } },
  task: { spec: "o|Task|?", arguments: {} },
  updatedAt: { spec: "s|DateTime|?", arguments: {} }
} };
var object_default_Company = { name: "Company", fields: {
  createdAt: { spec: "s|DateTime|!", arguments: {} },
  departments: { spec: "o|Department|![]!", arguments: {} },
  employees: { spec: "o|Employee|![]!", arguments: { limit: "s|Int|?", role: "e|EmployeeRole|?" } },
  id: { spec: "s|ID|!", arguments: {} },
  industry: { spec: "s|String|?", arguments: {} },
  name: { spec: "s|String|!", arguments: {} },
  updatedAt: { spec: "s|DateTime|?", arguments: {} }
} };
var object_default_Department = { name: "Department", fields: {
  budget: { spec: "s|BigInt|?", arguments: {} },
  company: { spec: "o|Company|!", arguments: {} },
  createdAt: { spec: "s|DateTime|!", arguments: {} },
  id: { spec: "s|ID|!", arguments: {} },
  manager: { spec: "o|Employee|?", arguments: {} },
  name: { spec: "s|String|!", arguments: {} },
  teams: { spec: "o|Team|![]!", arguments: {} },
  updatedAt: { spec: "s|DateTime|?", arguments: {} }
} };
var object_default_Employee = { name: "Employee", fields: {
  comments: { spec: "o|Comment|![]!", arguments: {} },
  createdAt: { spec: "s|DateTime|!", arguments: {} },
  department: { spec: "o|Department|?", arguments: {} },
  email: { spec: "s|String|!", arguments: {} },
  id: { spec: "s|ID|!", arguments: {} },
  manager: { spec: "o|Employee|?", arguments: {} },
  name: { spec: "s|String|!", arguments: {} },
  reports: { spec: "o|Employee|![]!", arguments: { limit: "s|Int|?" } },
  role: { spec: "e|EmployeeRole|!", arguments: {} },
  salary: { spec: "s|BigInt|?", arguments: {} },
  tasks: { spec: "o|Task|![]!", arguments: { completed: "s|Boolean|?", limit: "s|Int|?" } },
  team: { spec: "o|Team|?", arguments: {} },
  updatedAt: { spec: "s|DateTime|?", arguments: {} }
} };
var object_default_Mutation = { name: "Mutation", fields: {
  addComment: { spec: "o|Comment|!", arguments: { body: "s|String|!", taskId: "s|ID|!" } },
  assignTask: { spec: "o|Task|!", arguments: { employeeId: "s|ID|!", taskId: "s|ID|!" } },
  createProject: { spec: "o|Project|!", arguments: { input: "i|CreateProjectInput|!" } },
  createTask: { spec: "o|Task|!", arguments: { input: "i|CreateTaskInput|!", projectId: "s|ID|!" } },
  deleteComment: { spec: "s|Boolean|!", arguments: { id: "s|ID|!" } },
  deleteProject: { spec: "s|Boolean|!", arguments: { id: "s|ID|!" } },
  deleteTask: { spec: "s|Boolean|!", arguments: { id: "s|ID|!" } },
  replyToComment: { spec: "o|Comment|!", arguments: { body: "s|String|!", parentId: "s|ID|!" } },
  transferEmployee: { spec: "o|Employee|!", arguments: { input: "i|TransferEmployeeInput|!" } },
  unassignTask: { spec: "o|Task|!", arguments: { taskId: "s|ID|!" } },
  updateProject: { spec: "o|Project|!", arguments: { id: "s|ID|!", input: "i|UpdateProjectInput|!" } },
  updateTask: { spec: "o|Task|!", arguments: { id: "s|ID|!", input: "i|UpdateTaskInput|!" } }
} };
var object_default_Project = { name: "Project", fields: {
  assignees: { spec: "o|Employee|![]!", arguments: {} },
  createdAt: { spec: "s|DateTime|!", arguments: {} },
  description: { spec: "s|String|?", arguments: {} },
  id: { spec: "s|ID|!", arguments: {} },
  metadata: { spec: "s|JSON|?", arguments: {} },
  priority: { spec: "s|Int|?", arguments: {} },
  status: { spec: "e|ProjectStatus|!", arguments: {} },
  tasks: { spec: "o|Task|![]!", arguments: { completed: "s|Boolean|?", limit: "s|Int|?" } },
  team: { spec: "o|Team|!", arguments: {} },
  title: { spec: "s|String|!", arguments: {} },
  updatedAt: { spec: "s|DateTime|?", arguments: {} }
} };
var object_default_Query = { name: "Query", fields: {
  activityFeed: { spec: "u|ActivityItem|![]!", arguments: { limit: "s|Int|?", since: "s|DateTime|?", userId: "s|ID|!" } },
  comment: { spec: "o|Comment|?", arguments: { id: "s|ID|!" } },
  companies: { spec: "o|Company|![]!", arguments: { limit: "s|Int|?", offset: "s|Int|?" } },
  company: { spec: "o|Company|?", arguments: { id: "s|ID|!" } },
  department: { spec: "o|Department|?", arguments: { id: "s|ID|!" } },
  departments: { spec: "o|Department|![]!", arguments: { companyId: "s|ID|?", limit: "s|Int|?" } },
  employee: { spec: "o|Employee|?", arguments: { id: "s|ID|!" } },
  employees: { spec: "o|Employee|![]!", arguments: { departmentId: "s|ID|?", filter: "i|EmployeeFilterInput|?", limit: "s|Int|?", teamId: "s|ID|?" } },
  node: { spec: "s|Node|?", arguments: { id: "s|ID|!" } },
  project: { spec: "o|Project|?", arguments: { id: "s|ID|!" } },
  projects: { spec: "o|Project|![]!", arguments: { filter: "i|ProjectFilterInput|?", pagination: "i|PaginationInput|?", sort: "i|SortInput|?" } },
  search: { spec: "u|SearchResult|![]!", arguments: { limit: "s|Int|?", query: "s|String|!", types: "s|String|![]?" } },
  task: { spec: "o|Task|?", arguments: { id: "s|ID|!" } },
  tasks: { spec: "o|Task|![]!", arguments: { assigneeId: "s|ID|?", filter: "i|TaskFilterInput|?", limit: "s|Int|?", projectId: "s|ID|?" } },
  team: { spec: "o|Team|?", arguments: { id: "s|ID|!" } },
  teams: { spec: "o|Team|![]!", arguments: { departmentId: "s|ID|?", limit: "s|Int|?" } }
} };
var object_default_Subscription = { name: "Subscription", fields: {
  commentAdded: { spec: "o|Comment|!", arguments: { taskId: "s|ID|!" } },
  employeeActivity: { spec: "u|ActivityItem|!", arguments: { employeeId: "s|ID|!" } },
  projectUpdated: { spec: "o|Project|!", arguments: { projectId: "s|ID|!" } },
  taskCreated: { spec: "o|Task|!", arguments: { projectId: "s|ID|?" } },
  taskUpdated: { spec: "o|Task|!", arguments: { taskId: "s|ID|!" } }
} };
var object_default_Task = { name: "Task", fields: {
  assignee: { spec: "o|Employee|?", arguments: {} },
  comments: { spec: "o|Comment|![]!", arguments: { limit: "s|Int|?" } },
  completed: { spec: "s|Boolean|!", arguments: {} },
  createdAt: { spec: "s|DateTime|!", arguments: {} },
  dueDate: { spec: "s|DateTime|?", arguments: {} },
  estimatedHours: { spec: "s|Float|?", arguments: {} },
  id: { spec: "s|ID|!", arguments: {} },
  priority: { spec: "e|TaskPriority|?", arguments: {} },
  project: { spec: "o|Project|!", arguments: {} },
  title: { spec: "s|String|!", arguments: {} },
  updatedAt: { spec: "s|DateTime|?", arguments: {} }
} };
var object_default_Team = { name: "Team", fields: {
  department: { spec: "o|Department|!", arguments: {} },
  id: { spec: "s|ID|!", arguments: {} },
  lead: { spec: "o|Employee|?", arguments: {} },
  members: { spec: "o|Employee|![]!", arguments: { limit: "s|Int|?" } },
  name: { spec: "s|String|!", arguments: {} },
  projects: { spec: "o|Project|![]!", arguments: { limit: "s|Int|?", status: "e|ProjectStatus|?" } }
} };

// playgrounds/expo-metro/src/graphql-system/_defs/unions.ts
var union_default_ActivityItem = { name: "ActivityItem", types: { Comment: true, Project: true, Task: true } };
var union_default_SearchResult = { name: "SearchResult", types: { Comment: true, Employee: true, Project: true, Task: true } };

// playgrounds/expo-metro/src/graphql-system/_defs/type-names.ts
var typeNames_default = {
  scalar: ["ID", "String", "Int", "Float", "Boolean", "BigInt", "DateTime", "JSON"],
  enum: ["EmployeeRole", "ProjectStatus", "SortOrder", "TaskPriority"],
  input: ["BigIntFilter", "BooleanFilter", "CreateProjectInput", "CreateTaskInput", "DateTimeFilter", "DepartmentFilterInput", "EmployeeFilterInput", "EmployeeRoleFilter", "IntFilter", "PaginationInput", "ProjectFilterInput", "ProjectStatusFilter", "SortInput", "StringFilter", "TaskFilterInput", "TaskPriorityFilter", "TeamFilterInput", "TransferEmployeeInput", "UpdateProjectInput", "UpdateTaskInput"]
};

// playgrounds/expo-metro/src/graphql-system/_internal.ts
var import_core3 = require("@soda-gql/core");
var enum_default = { EmployeeRole: enum_default_EmployeeRole, ProjectStatus: enum_default_ProjectStatus, SortOrder: enum_default_SortOrder, TaskPriority: enum_default_TaskPriority };
var input_default = { BigIntFilter: input_default_BigIntFilter, BooleanFilter: input_default_BooleanFilter, CreateProjectInput: input_default_CreateProjectInput, CreateTaskInput: input_default_CreateTaskInput, DateTimeFilter: input_default_DateTimeFilter, DepartmentFilterInput: input_default_DepartmentFilterInput, EmployeeFilterInput: input_default_EmployeeFilterInput, EmployeeRoleFilter: input_default_EmployeeRoleFilter, IntFilter: input_default_IntFilter, PaginationInput: input_default_PaginationInput, ProjectFilterInput: input_default_ProjectFilterInput, ProjectStatusFilter: input_default_ProjectStatusFilter, SortInput: input_default_SortInput, StringFilter: input_default_StringFilter, TaskFilterInput: input_default_TaskFilterInput, TaskPriorityFilter: input_default_TaskPriorityFilter, TeamFilterInput: input_default_TeamFilterInput, TransferEmployeeInput: input_default_TransferEmployeeInput, UpdateProjectInput: input_default_UpdateProjectInput, UpdateTaskInput: input_default_UpdateTaskInput };
var object_default = { Comment: object_default_Comment, Company: object_default_Company, Department: object_default_Department, Employee: object_default_Employee, Mutation: object_default_Mutation, Project: object_default_Project, Query: object_default_Query, Subscription: object_default_Subscription, Task: object_default_Task, Team: object_default_Team };
var union_default = { ActivityItem: union_default_ActivityItem, SearchResult: union_default_SearchResult };
var fullSchema_default = {
  label: "default",
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" },
  scalar,
  enum: enum_default,
  input: input_default,
  object: object_default,
  union: union_default
};
var minimalSchema_default = {
  label: "default",
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" },
  object: { Comment: object_default_Comment.fields, Company: object_default_Company.fields, Department: object_default_Department.fields, Employee: object_default_Employee.fields, Mutation: object_default_Mutation.fields, Project: object_default_Project.fields, Query: object_default_Query.fields, Subscription: object_default_Subscription.fields, Task: object_default_Task.fields, Team: object_default_Team.fields },
  union: {
    ActivityItem: ["Comment", "Project", "Task"],
    SearchResult: ["Comment", "Employee", "Project", "Task"]
  },
  typeNames: typeNames_default
};
var customDirectives_default = { ...(0, import_core3.createStandardDirectives)(), ...{} };
var gql_default = (0, import_core3.createGqlElementComposer)(minimalSchema_default, { directiveMethods: customDirectives_default });

// playgrounds/expo-metro/src/graphql-system/index.ts
var gql = {
  default: gql_default
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  __directiveMethods_default,
  __fullSchema_default,
  __gql_default,
  __schema_default,
  gql
});
