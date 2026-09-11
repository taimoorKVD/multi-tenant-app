import {ApiBearerAuth, ApiBody, ApiOperation, ApiResponse,} from '@nestjs/swagger';
import {applyDecorators} from '@nestjs/common';
import {ForgotPasswordDto, LoginDto, RefreshTokenDto, ResetPasswordDto, VerifyEmailDto, VerifyResetTokenDto} from '../dto';

export const TenantAuthLoginDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Authenticate and obtain access token',
            description:
                'Logs in a tenant user using email and password. Use the tenant route or provide tenant_slug when calling the generic login endpoint.',
        }),
        ApiBody({
            description: 'Credentials for tenant user login',
            type: LoginDto,
            examples: {
                valid: {
                    summary: 'Valid login request example',
                    value: {
                        email: 'admin@kingdomvision.com',
                        password: 'Admin@123',
                        tenant_slug: 'kingdomvision',
                    },
                },
                missingEmail: {
                    summary: 'Missing email field',
                    value: {
                        password: 'Admin@123',
                    },
                },
                missingPassword: {
                    summary: 'Missing password field',
                    value: {
                        email: 'admin@kingdomvision.com',
                    },
                },
            },
        } as any),
        ApiResponse({
            status: 200,
            description: 'Successfully authenticated.',
            schema: {
                example: {
                    success: true,
                    message: 'Login successful',
                    user_type: 'tenant',
                    account_type: 'tenant_admin',
                    tenant_slug: 'kingdomvision',
                    tenant: 'tenant_kingdomvision',
                    plan: { id: 1, name: 'Basic', slug: 'basic' },
                    allowedModules: [
                        'dashboard',
                        'users',
                        'roles',
                        'jobpositions',
                        'locations',
                        'items',
                        'vendors',
                    ],
                    modules: [
                        { key: 'dashboard', name: 'Dashboard', enabled: true },
                        { key: 'users', name: 'Users', enabled: true },
                        { key: 'data-collection', name: 'Data Collection', enabled: false },
                    ],
                    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    user: {
                        id: 1,
                        email: 'admin@kingdomvision.com',
                        name: 'Administrator',
                        account_type: 'tenant_admin',
                        job_position: {
                            id: 2,
                            name: 'Store Manager',
                        },
                        role: {
                            id: 1,
                            name: 'Senior Manager',
                            createdAt: '2026-04-14T00:52:55.371Z',
                            updatedAt: '2026-04-14T17:26:41.358Z',
                            permissions: [
                                {
                                    module: { name: 'User' },
                                    permissions: [{ id: 1, name: 'Create' }],
                                },
                                {
                                    module: { name: 'Job Position' },
                                    permissions: [{ id: 2, name: 'View' }],
                                },
                                {
                                    module: { name: 'Location' },
                                    permissions: [
                                        { id: 5, name: 'Edit' },
                                        { id: 6, name: 'View' },
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
        }),
        ApiResponse({
            status: 400,
            description: 'Validation error — missing or invalid fields.',
            schema: {
                example: {
                    success: false,
                    message: 'Validation failed',
                    errors: [
                        {
                            field: 'password',
                            messages: ['Password cannot be empty. Please enter your password.'],
                        },
                    ],
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized — incorrect email or password.',
            schema: {
                example: {
                    success: false,
                    message: 'The email or password you entered is incorrect.',
                    statusCode: 401,
                },
            },
        }),
    );

export const TenantAuthGetUserDocs = () =>
    applyDecorators(
        ApiBearerAuth('access-token'),
        ApiOperation({
            summary: 'Get authenticated user details',
            description:
                'Retrieves the currently logged-in tenant user profile based on the provided JWT token.',
        }),
        ApiResponse({
            status: 200,
            description: 'Authenticated user details',
            schema: {
                example: {
                    success: true,
                    message: 'Session is active.',
                    user_type: 'tenant',
                    account_type: 'tenant_admin',
                    tenant_slug: 'kingdomvision',
                    tenant: 'tenant_kingdomvision',
                    plan: { id: 1, name: 'Basic', slug: 'basic' },
                    allowedModules: [
                        'dashboard',
                        'users',
                        'roles',
                        'jobpositions',
                        'locations',
                        'items',
                        'vendors',
                    ],
                    modules: [
                        { key: 'dashboard', name: 'Dashboard', enabled: true },
                        { key: 'data-collection', name: 'Data Collection', enabled: false },
                    ],
                    user: {
                        id: 1,
                        name: 'Administrator',
                        email: 'admin@kingdomvision.com',
                        email_verified: true,
                        account_type: 'tenant_admin',
                        job_position: {
                            id: 2,
                            name: 'Store Manager',
                        },
                        role: {
                            id: 1,
                            name: 'Senior Manager',
                            permissions: [
                                {
                                    module: { name: 'User' },
                                    permissions: [{ id: 1, name: 'Create' }],
                                },
                                {
                                    module: { name: 'Job Position' },
                                    permissions: [{ id: 2, name: 'View' }],
                                },
                            ],
                        },
                        is_system: false,
                        createdAt: '2026-04-14T00:52:55.371Z',
                        updatedAt: '2026-04-14T17:26:41.358Z',
                    },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized or Session expired.',
            schema: {
                example: {
                    message: 'Your session has expired or is invalid. Please log in again.',
                    error: 'Unauthorized',
                    statusCode: 401,
                    success: false,
                },
            },
        }),
    );

export const TenantAuthForgotPasswordDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Send password reset email',
            description:
                'Generates a one-time password reset token and sends a reset email for an existing tenant account.',
        }),
        ApiBody({
            type: ForgotPasswordDto,
            description: 'Email address for password reset.',
            examples: {
                valid: {
                    summary: 'Forgot password request',
                    value: {
                        email: 'admin@kingdomvision.com',
                        tenant_slug: 'kingdomvision',
                    },
                },
            },
        } as any),
        ApiResponse({
            status: 200,
            description: 'Reset email request accepted.',
            schema: {
                example: {
                    success: true,
                    message: 'Password reset link has been sent to the registered email.',
                },
            },
        }),
        ApiResponse({
            status: 404,
            description: 'Account not found for the provided email.',
        }),
    );

export const TenantAuthVerifyResetTokenDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Verify password reset token',
            description: 'Verifies whether the password reset token is valid and not expired.',
        }),
        ApiBody({
            type: VerifyResetTokenDto,
            description: 'Email and reset token to verify.',
            examples: {
                valid: {
                    summary: 'Verify reset token request',
                    value: {
                        email: 'admin@kingdomvision.com',
                        token: 'd11b0d6f84bb14d1470f6da0f5ea0de31fa53c53cb8bd0b37c2f67ff7d5a9f66',
                        tenant_slug: 'kingdomvision',
                    },
                },
            },
        } as any),
        ApiResponse({
            status: 200,
            description: 'Reset token is valid.',
            schema: {
                example: {
                    success: true,
                    message: 'Reset token is valid.',
                },
            },
        }),
        ApiResponse({
            status: 400,
            description: 'Reset token is invalid or expired.',
        }),
    );

export const TenantAuthResetPasswordDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Reset password',
            description:
                'Resets tenant account password using a valid one-time token. Token is invalidated after successful reset.',
        }),
        ApiBody({
            type: ResetPasswordDto,
            description: 'Email, reset token, and new password details.',
            examples: {
                valid: {
                    summary: 'Reset password request',
                    value: {
                        email: 'admin@kingdomvision.com',
                        token: 'd11b0d6f84bb14d1470f6da0f5ea0de31fa53c53cb8bd0b37c2f67ff7d5a9f66',
                        password: 'NewStrongPassword123!',
                        password_confirm: 'NewStrongPassword123!',
                        tenant_slug: 'kingdomvision',
                    },
                },
            },
        } as any),
        ApiResponse({
            status: 200,
            description: 'Password reset completed.',
            schema: {
                example: {
                    success: true,
                    message: 'Password reset successful. You can now log in with your new password.',
                },
            },
        }),
        ApiResponse({
            status: 400,
            description: 'Reset token is invalid/expired or password confirmation failed.',
        }),
    );

export const TenantAuthEmailVerificationDocs = (mode: 'send' | 'verify') =>
    applyDecorators(
        ApiOperation({
            summary: mode === 'send' ? 'Send email verification link' : 'Verify email address',
            description:
                mode === 'send'
                    ? 'Generates a one-time email verification token for tenant or tenant-user login and sends a verification email if the account exists.'
                    : 'Marks the tenant account email as verified when a valid verification token is provided.',
        }),
        ApiBody({
            type: mode === 'send' ? ForgotPasswordDto : VerifyEmailDto,
            description: mode === 'send' ? 'Email address for verification.' : 'Email and verification token.',
        } as any),
        ApiResponse({
            status: 200,
            description: mode === 'send' ? 'Verification email request accepted.' : 'Email verified successfully.',
            schema: {
                example:
                    mode === 'send'
                        ? {
                            success: true,
                            message: 'If the account exists, an email verification link has been sent to the registered email.',
                        }
                        : {
                            success: true,
                            message: 'Email verified successfully.',
                        },
            },
        }),
        ApiResponse({
            status: 400,
            description: 'Verification token is invalid or expired.',
        }),
    );

export const TenantAuthRefreshTokenDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Rotate refresh token',
            description:
                'Exchanges a valid tenant refresh token for a new access token and a rotated refresh token. Response includes the same `user` block as login (fresh permissions).',
        }),
        ApiBody({
            type: RefreshTokenDto,
            description: 'Refresh token payload.',
        } as any),
        ApiResponse({
            status: 200,
            description: 'Tokens refreshed successfully.',
            schema: {
                example: {
                    success: true,
                    message: 'Token refreshed successfully.',
                    user_type: 'tenant',
                    account_type: 'tenant_admin',
                    tenant_slug: 'kingdomvision',
                    tenant: 'tenant_kingdomvision',
                    plan: { id: 1, name: 'Basic', slug: 'basic' },
                    allowedModules: [
                        'dashboard',
                        'users',
                        'roles',
                        'jobpositions',
                        'locations',
                        'items',
                        'vendors',
                    ],
                    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
                    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
                    expires_in: '2h',
                    refresh_expires_in_days: 7,
                    user: {
                        id: 1,
                        email: 'admin@tenant.com',
                        name: 'Admin',
                        email_verified: true,
                        account_type: 'tenant_admin',
                        job_position: { id: 2, name: 'Manager' },
                        role: { id: 1, name: 'Admin', permissions: [] },
                    },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Refresh token is invalid or expired.',
        }),
    );

export const TenantAuthResyncSessionDocs = () =>
    applyDecorators(
        ApiBearerAuth('access-token'),
        ApiOperation({
            summary: 'Resync session permissions',
            description:
                'Re-issues access and refresh tokens from the current access JWT after job-position/role permission changes. Use when the realtime event `permissions.changed` arrives (refresh tokens were revoked).',
        }),
        ApiResponse({
            status: 200,
            description: 'Session resynced with fresh permissions.',
            schema: {
                example: {
                    success: true,
                    message: 'Session permissions resynced successfully.',
                    user_type: 'tenant',
                    account_type: 'tenant_user',
                    tenant_slug: 'kingdomvision',
                    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
                    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
                    expires_in: '2h',
                    refresh_expires_in_days: 7,
                    user: {
                        id: 10,
                        email: 'employee@tenant.com',
                        name: 'Employee',
                        email_verified: true,
                        account_type: 'tenant_user',
                        job_position: { id: 3, name: 'Staff' },
                        role: { id: 2, name: 'Employee', permissions: [] },
                    },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Access token missing or invalid.',
        }),
    );

export const TenantAuthLogoutDocs = () =>
    applyDecorators(
        ApiBearerAuth('access-token'),
        ApiOperation({
            summary: 'Logout tenant session',
            description:
                'Revokes the supplied refresh token for the authenticated tenant user. The current access token remains valid until it expires.',
        }),
        ApiBody({
            type: RefreshTokenDto,
            description: 'Refresh token to revoke.',
        } as any),
        ApiResponse({
            status: 200,
            description: 'Logged out successfully.',
            schema: {
                example: {
                    success: true,
                    message: 'Logged out successfully.',
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized or invalid refresh token.',
        }),
    );
