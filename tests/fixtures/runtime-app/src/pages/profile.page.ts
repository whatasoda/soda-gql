import { profileQuery } from "./profile.query";

type ProfilePageDescriptor = {
  readonly query: typeof profileQuery;
  readonly provideVariables: (id: string, categoryId?: string) => {
    readonly userId: string;
    readonly categoryId?: string;
  };
};

export const profilePage: ProfilePageDescriptor = {
  query: profileQuery,
  provideVariables: (id, categoryId) => ({
    userId: id,
    categoryId,
  }),
};
