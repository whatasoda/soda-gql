import { NextResponse } from "next/server";
import { getEmployeeQuery } from "@/graphql/operations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const taskLimit = searchParams.get("taskLimit");

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId parameter" }, { status: 400 });
  }

  // Get the operation metadata to demonstrate webpack plugin transformation
  const metadata = getEmployeeQuery.metadata;

  return NextResponse.json({
    message: "soda-gql operation ready",
    variables: {
      employeeId,
      taskLimit: taskLimit ? parseInt(taskLimit, 10) : undefined,
    },
    operationMetadata: metadata,
  });
}
