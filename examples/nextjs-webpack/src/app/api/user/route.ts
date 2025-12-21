import { getUserQuery } from "@/graphql/operations";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const categoryId = searchParams.get("categoryId");

  if (!id || !categoryId) {
    return NextResponse.json({ error: "Missing id or categoryId parameter" }, { status: 400 });
  }

  // Get the operation metadata to demonstrate webpack plugin transformation
  const metadata = getUserQuery.metadata;

  return NextResponse.json({
    message: "soda-gql operation ready",
    variables: { userId: id, categoryId },
    operationMetadata: metadata,
  });
}
