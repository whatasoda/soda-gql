import { Controller, Get, Param } from "@nestjs/common";
import { EmployeeService } from "./services/employee.service";

@Controller()
export class AppController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get("employees/:id")
  async getEmployee(@Param("id") id: string) {
    return this.employeeService.getEmployee(id);
  }

  @Get("employees")
  async getEmployees() {
    return this.employeeService.getEmployees();
  }

  @Get()
  getHello() {
    return {
      message: "NestJS with soda-gql TypeScript Compiler Plugin",
      endpoints: {
        employee: "/employees/:id",
        employees: "/employees",
      },
    };
  }
}
