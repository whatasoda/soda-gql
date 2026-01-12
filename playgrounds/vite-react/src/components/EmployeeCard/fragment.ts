import { createProjection } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";

/**
 * Fragment for EmployeeCard component.
 * Defines the data requirements colocated with the component.
 */
export const employeeCardFragment = gql.default(({ fragment, $var }) =>
  fragment.Query({
    variables: { ...$var("employeeId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
        ...f.role(),
        ...f.department()(({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
      })),
    }),
  }),
);

/**
 * Projection for EmployeeCard component.
 * Defines how to extract and transform data from the execution result.
 */
export const employeeCardProjection = createProjection(employeeCardFragment, {
  paths: ["$.employee"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, employee: null };
    if (result.isEmpty()) return { error: null, employee: null };
    const [employee] = result.unwrap();
    return { error: null, employee };
  },
});
