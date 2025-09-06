import type { UserForIterate } from "../../../../entities/user/models/user.remote-model";

type Props = {
  users: UserForIterate[];
};

export const UserSelect: React.FC<Props> = ({ users }) => {
  return <div>{users.map((user) => user.name).join(", ")}</div>;
};
