import {INestApplication} from '@nestjs/common';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {MasterAuthModule} from '../master/auth/auth.module';
import {UsersModule as MasterUsersModule} from '../master/users/users.module';
import {RoleModule as MasterRoleModule} from '../master/role/role.module';
import {PermissionModule as MasterPermissionModule} from '../master/permission/permission.module';
import {TenantsModule as MasterTenantsModule} from '../master/tenants/tenants.module';
import {JobPositionModule as MasterJobPositionModule} from '../master/job-position/job-position.module';
import {CountriesModule as MasterCountriesModule} from '../master/countries/countries.module';
import {CitiesModule as MasterCitiesModule} from '../master/cities/cities.module';
import {StatesModule as MasterStatesModule} from '../master/states/states.module';
import {MailAdminModule as MasterMailAdminModule} from '../master/mail/mail-admin.module';
import {ActivityLogsModule as MasterActivityLogsModule} from '../master/activity-logs/activity-logs.module';
import {TenantAuthModule} from '../tenants/auth/auth.module';
import {UsersModule as TenantUsersModule} from '../tenants/users/users.module';
import {RoleModule as TenantRoleModule} from '../tenants/role/role.module';
import {PermissionModule as TenantPermissionModule} from '../tenants/permission/permission.module';
import {JobPositionsModule as TenantJobPositionModule} from '../tenants/job-positions/job-positions.module';
import {LocationsModule as TenantLocationsModule} from '../tenants/locations/locations.module';
import {VendorsModule as TenantVendorsModule} from '../tenants/vendors/vendors.module';
import {MailModule} from '../mail/mail.module';
import { TenantMailAdminModule } from '../tenants/mail/tenant-mail-admin.module';
import { ReportingGroupsModule as TenantReportingGroupsModule } from '../tenants/reporting-groups/reporting-groups.module';
import { ReportingCategoriesModule as TenantReportingCategoriesModule } from '../tenants/reporting-categories/reporting-categories.module';
import { ItemsModule as TenantItemsModule } from '../tenants/items/items.module';
import { FormBuilderModule as TenantFormBuilderModule } from '../tenants/form-builder/form-builder.module';
import { DataCollectionModule as TenantDataCollectionModule } from '../tenants/data-collection/data-collection.module';
import { BillingModule as MasterBillingModule } from '../master/billing/billing.module';
import { DashboardModule as MasterDashboardModule } from '../master/dashboard/dashboard.module';

export function setupSwagger(app: INestApplication) {

    // Common bearer auth
    const commonAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
    } as const;

    // Master API document builder
    const masterConfig = new DocumentBuilder()
        .setTitle('Master API Collection')
        .setDescription(
            'This collection documents all endpoints for the **Master App** — e.g., tenants, users, roles, and permissions.',
        )
        .setVersion('1.0.0')
        .addBearerAuth(commonAuth, 'access-token')
        .build();

    // Tenant API document builder
    const tenantConfig = new DocumentBuilder()
        .setTitle('Tenant API Collection')
        .setDescription(
            'This collection documents all endpoints for the **Tenant App** — e.g., users, locations, and internal management features.',
        )
        .setVersion('1.0.0')
        .addBearerAuth(commonAuth, 'access-token')
        .build();

    // Create Swagger documents
    const masterDocument = SwaggerModule.createDocument(app, masterConfig, {
        include: [
            MasterAuthModule,
            MasterUsersModule,
            MasterTenantsModule,
            MasterRoleModule,
            MasterPermissionModule,
            MasterJobPositionModule,
            MasterCountriesModule,
            MasterCitiesModule,
            MasterStatesModule,
            MasterMailAdminModule,
            MasterActivityLogsModule,
            MasterDashboardModule,
            MasterBillingModule,
        ],
    });

    const tenantDocument = SwaggerModule.createDocument(app, tenantConfig, {
        include: [
            TenantAuthModule,
            TenantUsersModule,
            TenantRoleModule,
            TenantPermissionModule,
            TenantJobPositionModule,
            TenantLocationsModule,
            TenantVendorsModule,
            TenantReportingGroupsModule,
            TenantReportingCategoriesModule,
            TenantItemsModule,
            TenantFormBuilderModule,
            TenantDataCollectionModule,
            MailModule,
            TenantMailAdminModule,
        ],
    });

    // Shared options for both
    const cdnAssets = {
        customCssUrl: [
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.19.0/swagger-ui.css',
        ],
        customJs: [
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.19.0/swagger-ui-bundle.js',
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.19.0/swagger-ui-standalone-preset.js',
        ],
    };

    // Master Swagger UI
    SwaggerModule.setup('api/collection/master', app, masterDocument, {
        ...cdnAssets,
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
                    'Country Management',
                    'State Management',
                    'City Management',
                    'Email Management',
                    'Activity Logs',
                    'Plan Management',
                    'Subscriptions',
                    'Billing & Invoices',
                    'Tenant Locations',
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
            docExpansion: 'list',
            defaultModelsExpandDepth: -1,
        },
        customSiteTitle: 'Master API Docs',
    });

    // Tenant Swagger UI
    SwaggerModule.setup('api/collection/tenant', app, tenantDocument, {
        ...cdnAssets,
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: (a, b) => {
                const order = [
                    'Authentication',
                    'Role Management',
                    'Permission Management',
                    'User Management',
                    'Job Position Management',
                    'Location Management',
                    'Vendor Management',
                    'Reporting Group Management',
                    'Reporting Category Management',
                    'Item Management',
                    'Form Builder Management - Forms',
                    'Form Builder Management - Versions',
                    'Email Management',
                    'Email Testing',
                    'Data Collection - Templates',
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
            docExpansion: 'list',
            defaultModelsExpandDepth: -1,
        },
        customSiteTitle: 'Tenant API Docs',
    });
}
