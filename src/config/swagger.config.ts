import {INestApplication} from '@nestjs/common';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {TenantsModule} from '../tenants/tenants.module';
import {MasterAuthModule} from "../master/auth/auth.module";
import {UsersModule, UsersModule as TenantUsersModule} from "../master/users/users.module";
import {RoleModule, RoleModule as TenantRoleModule} from "../master/role/role.module";
import {PermissionModule, PermissionModule as TenantPermissionModule} from "../master/permission/permission.module";
import {
    JobPositionModule,
    JobPositionModule as TenantJobPositionModule
} from "../master/job-position/job-position.module";
import {TenantAuthModule} from "../tenants/auth/auth.module";

export function setupSwagger(app: INestApplication) {
    const commonAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
    } as const;

    const masterConfig = new DocumentBuilder()
        .setTitle('Master API Collection')
        .setDescription(
            'This collection documents all endpoints for the **Master App** — e.g., tenants, users, roles, and permissions.',
        ).setVersion('1.0.0').addBearerAuth(commonAuth, 'access-token').build();

    const tenantConfig = new DocumentBuilder()
        .setTitle('Tenant API Collection')
        .setDescription(
            'This collection documents all endpoints for the **Tenant App** — e.g., users, locations, and internal management features.',
        ).setVersion('1.0.0').addBearerAuth(commonAuth, 'access-token').build();

    const masterDocument = SwaggerModule.createDocument(app, masterConfig, {
        include: [
            MasterAuthModule,
            UsersModule,
            TenantsModule,
            RoleModule,
            PermissionModule,
            JobPositionModule,
        ],
    });
    const tenantDocument = SwaggerModule.createDocument(app, tenantConfig, {
        include: [
            TenantAuthModule,
            TenantUsersModule,
            TenantRoleModule,
            TenantPermissionModule,
            TenantJobPositionModule
        ],
    });

    SwaggerModule.setup('api/collection/master', app, masterDocument, {
        customCssUrl: [
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.19.0/swagger-ui.css',
        ],
        customJs: [
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.19.0/swagger-ui-bundle.js',
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.19.0/swagger-ui-standalone-preset.js',
        ],
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: (a, b) => {
                const order = [
                    'Authentication',
                    'Role Management',
                    'Permission Management',
                    'User Management',
                    'Tenant Management',
                    'Job Position Management',
                ];
                const idxA = order.indexOf(a);
                const idxB = order.indexOf(b);
                return (idxA === -1 ? order.length : idxA) - (idxB === -1 ? order.length : idxB);
            },
            operationsSorter: (a: any, b: any) => {
                const order = ['post', 'get', 'patch', 'put', 'delete'];
                const methodA = a.get('method');
                const methodB = b.get('method');
                return order.indexOf(methodA) - order.indexOf(methodB);
            },
            docExpansion: 'full',
            defaultModelsExpandDepth: -1,
        },
        customSiteTitle: 'Master API Docs',
    });

    SwaggerModule.setup('api/collection/tenant', app, tenantDocument, {
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
            docExpansion: 'full',
            defaultModelsExpandDepth: -1,
        },
        customSiteTitle: 'Tenant API Docs',
    });
}
