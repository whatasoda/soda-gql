import { createProjection } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";

/**
 * Fragment for CompanyHierarchy component.
 * Demonstrates deep nesting: Company → Department → Team → Project (4 levels).
 */
export const companyHierarchyFragment = gql.default(({ fragment, $var }) =>
  fragment.Query({
    variables: {
      ...$var("companyId").ID("!"),
      ...$var("projectStatus").ProjectStatus("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.company({ id: $.companyId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.industry(),
        ...f.departments({})(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.teams({})(({ f }) => ({
            ...f.id(),
            ...f.name(),
            ...f.projects({ status: $.projectStatus })(({ f }) => ({
              ...f.id(),
              ...f.title(),
              ...f.status(),
            })),
          })),
        })),
      })),
    }),
  }),
);

/**
 * Projection for CompanyHierarchy component.
 */
export const companyHierarchyProjection = createProjection(companyHierarchyFragment, {
  paths: ["$.company"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, company: null };
    if (result.isEmpty()) return { error: null, company: null };
    const [company] = result.unwrap();
    return { error: null, company };
  },
});
