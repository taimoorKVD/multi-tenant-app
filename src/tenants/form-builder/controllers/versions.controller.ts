import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../../common/decorators';
import { PermissionsGuard } from '../guards';
import { VersionsService } from '../services';
import { TenantAuthGuard } from '../../auth/guards';
import { TenantFormBuilderVersionsSwagger } from '../swagger';

@TenantFormBuilderVersionsSwagger.Tags()
@TenantFormBuilderVersionsSwagger.Auth()
@UseGuards(TenantAuthGuard, PermissionsGuard)
@Controller()
export class VersionsController {
    constructor(private readonly versionsService: VersionsService) { }

    @Get(['forms/:id/versions', 'tenant/:tenantId/forms/:id/versions'])
    @Permissions('view-form')
    @TenantFormBuilderVersionsSwagger.FindAll()
    findAll(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.versionsService.findAll(req, id);
    }

    @Get(['forms/:id/versions/:version', 'tenant/:tenantId/forms/:id/versions/:version'])
    @Permissions('view-form')
    @TenantFormBuilderVersionsSwagger.FindOne()
    findOne(
        @Req() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Param('version', ParseIntPipe) version: number,
    ) {
        return this.versionsService.findOne(req, id, version);
    }

    @Post([
        'forms/:id/versions/restore/:version',
        'tenant/:tenantId/forms/:id/versions/restore/:version',
    ])
    @Permissions('publish-form')
    @TenantFormBuilderVersionsSwagger.Restore()
    restore(
        @Req() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Param('version', ParseIntPipe) version: number,
    ) {
        return this.versionsService.restore(req, id, version);
    }
}
