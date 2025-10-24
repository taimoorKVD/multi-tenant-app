import {Role} from "../../../tenants/role/entities";
import {User} from "../../../tenants/users/entities";


export interface IAdminSetup {
    role: Role;
    user: User;
}