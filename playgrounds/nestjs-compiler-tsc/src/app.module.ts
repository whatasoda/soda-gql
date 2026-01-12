import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { EmployeeService } from "./services/employee.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [EmployeeService],
})
export class AppModule {}
