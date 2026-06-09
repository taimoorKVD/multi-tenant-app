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

    @Get(['forms/:moduleSlug/versions', 'tenant/:tenantId/forms/:moduleSlug/versions'])
    @Permissions('view-form')
    @TenantFormBuilderVersionsSwagger.FindAll()
    findAll(@Req() req: any, @Param('moduleSlug') moduleSlug: string) {
        return this.versionsService.findAll(req, moduleSlug);
    }

    @Get(['forms/:moduleSlug/versions/:version', 'tenant/:tenantId/forms/:moduleSlug/versions/:version'])
    @Permissions('view-form')
    @TenantFormBuilderVersionsSwagger.FindOne()
    findOne(
        @Req() req: any,
        @Param('moduleSlug') moduleSlug: string,
        @Param('version', ParseIntPipe) version: number,
    ) {
        return this.versionsService.findOne(req, moduleSlug, version);
    }

    @Post([
        'forms/:moduleSlug/versions/restore/:version',
        'tenant/:tenantId/forms/:moduleSlug/versions/restore/:version',
    ])
    @Permissions('publish-form')
    @TenantFormBuilderVersionsSwagger.Restore()
    restore(
        @Req() req: any,
        @Param('moduleSlug') moduleSlug: string,
        @Param('version', ParseIntPipe) version: number,
    ) {
        return this.versionsService.restore(req, moduleSlug, version);
    }
}
