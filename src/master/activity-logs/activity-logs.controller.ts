import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MasterAccess } from '../../common/decorators';
import { ActivityLogsService } from './activity-logs.service';
import { ListActivityLogsDto } from './dto';
import { ActivityLogsSwagger } from './swagger';

@ApiTags('Activity Logs')
@ActivityLogsSwagger.Auth()
@Controller('master/activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @MasterAccess('view-tenant')
  @ActivityLogsSwagger.FindAll()
  listLogs(@Query() query: ListActivityLogsDto) {
    return this.activityLogsService.listLogs({
      page: query.page,
      limit: query.limit,
      module: query.module,
      action: query.action,
      method: query.method,
      statusCode: query.statusCode,
      userId: query.userId,
      endpoint: query.endpoint,
      tenant: query.tenant,
    });
  }

  @Get('search')
  @MasterAccess('view-tenant')
  @ActivityLogsSwagger.FindAll()
  searchLogs(@Query() query: ListActivityLogsDto) {
    return this.activityLogsService.listLogs({
      page: 1,
      limit: query.limit,
      module: query.module,
      action: query.action,
      method: query.method,
      statusCode: query.statusCode,
      userId: query.userId,
      endpoint: query.endpoint,
      tenant: query.tenant,
    });
  }

  @Get(':id')
  @MasterAccess('view-tenant')
  @ActivityLogsSwagger.FindOne()
  getLogById(@Param('id', ParseIntPipe) id: number) {
    return this.activityLogsService.getLogById(id);
  }
}
