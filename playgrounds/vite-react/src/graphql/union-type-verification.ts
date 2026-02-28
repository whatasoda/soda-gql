/**
 * Union Type Verification
 *
 * This file verifies type inference for union type selections in tagged templates.
 * It demonstrates that:
 * 1. __typename is correctly typed as a string literal union
 * 2. Inline fragments produce discriminated union output types
 * 3. Partial member selection only includes selected members in output type
 */

import type { activityFeedQuery, searchAllQuery, searchPartialQuery } from "./operations";

// ============================================================================
// SearchResult union - All members
// ============================================================================

type SearchAllOutput = (typeof searchAllQuery)["$infer"]["output"]["search"][number];

// Verify __typename is a string literal union
type SearchAllTypename = SearchAllOutput["__typename"];
const _verifySearchAllTypename: SearchAllTypename = "Employee"; // "Employee" | "Project" | "Task" | "Comment"

// Verify discriminated union - Employee member
function _handleEmployee(result: SearchAllOutput) {
  if (result.__typename === "Employee") {
    // In this branch, result is narrowed to Employee
    const _id: string = result.id;
    const _name: string = result.name;
    const _email: string = result.email;
    const _role: "ENGINEER" | "MANAGER" | "DIRECTOR" | "EXECUTIVE" | "INTERN" = result.role;
  }
}

// Verify discriminated union - Project member
function _handleProject(result: SearchAllOutput) {
  if (result.__typename === "Project") {
    // In this branch, result is narrowed to Project
    const _id: string = result.id;
    const _title: string = result.title;
    const _description: string | null | undefined = result.description;
    const _status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" = result.status;
  }
}

// Verify discriminated union - Task member
function _handleTask(result: SearchAllOutput) {
  if (result.__typename === "Task") {
    // In this branch, result is narrowed to Task
    const _id: string = result.id;
    const _title: string = result.title;
    const _completed: boolean = result.completed;
    const _priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null | undefined = result.priority;
  }
}

// Verify discriminated union - Comment member
function _handleComment(result: SearchAllOutput) {
  if (result.__typename === "Comment") {
    // In this branch, result is narrowed to Comment
    const _id: string = result.id;
    const _body: string = result.body;
    const _createdAt: string = result.createdAt;
  }
}

// ============================================================================
// SearchResult union - Partial member selection
// ============================================================================

type SearchPartialOutput = (typeof searchPartialQuery)["$infer"]["output"]["search"][number];

// Verify __typename only includes selected members (Employee and Project)
type SearchPartialTypename = SearchPartialOutput["__typename"];
const _verifySearchPartialTypename: SearchPartialTypename = "Employee"; // "Employee" | "Project" only

// Verify output type only includes selected members
function _handlePartialSearch(result: SearchPartialOutput) {
  if (result.__typename === "Employee") {
    // Employee with nested department
    const _id: string = result.id;
    const _name: string = result.name;
    const _email: string = result.email;
    const _role: "ENGINEER" | "MANAGER" | "DIRECTOR" | "EXECUTIVE" | "INTERN" = result.role;
    const _deptId: string | undefined = result.department?.id;
    const _deptName: string | undefined = result.department?.name;
  } else if (result.__typename === "Project") {
    // Project with nested team
    const _id: string = result.id;
    const _title: string = result.title;
    const _description: string | null | undefined = result.description;
    const _status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" = result.status;
    const _teamId: string = result.team.id;
    const _teamName: string = result.team.name;
  }
  // Task and Comment are not part of the output type
}

// ============================================================================
// ActivityItem union - All members with nested fields
// ============================================================================

type ActivityItemOutput = (typeof activityFeedQuery)["$infer"]["output"]["activityFeed"][number];

// Verify __typename includes all ActivityItem members
type ActivityItemTypename = ActivityItemOutput["__typename"];
const _verifyActivityItemTypename: ActivityItemTypename = "Task"; // "Task" | "Comment" | "Project"

// Verify discriminated union with nested field selection
function _handleActivityItem(item: ActivityItemOutput) {
  if (item.__typename === "Task") {
    // Task with assignee and project
    const _id: string = item.id;
    const _title: string = item.title;
    const _completed: boolean = item.completed;
    const _priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null | undefined = item.priority;
    const _dueDate: string | null | undefined = item.dueDate;
    if (item.assignee) {
      const _assigneeId: string = item.assignee.id;
      const _assigneeName: string = item.assignee.name;
    }
    const _projectId: string = item.project.id;
    const _projectTitle: string = item.project.title;
  } else if (item.__typename === "Comment") {
    // Comment with author and task
    const _id: string = item.id;
    const _body: string = item.body;
    const _createdAt: string = item.createdAt;
    const _authorId: string = item.author.id;
    const _authorName: string = item.author.name;
    if (item.task) {
      const _taskId: string = item.task.id;
      const _taskTitle: string = item.task.title;
    }
  } else if (item.__typename === "Project") {
    // Project with nested tasks
    const _id: string = item.id;
    const _title: string = item.title;
    const _description: string | null | undefined = item.description;
    const _status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" = item.status;
    const _priority: number | null | undefined = item.priority;
    const _tasks: Array<{ id: string; title: string; completed: boolean }> = item.tasks;
  }
}
