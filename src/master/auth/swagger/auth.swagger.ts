import {ApiBearerAuth, ApiBody, ApiOperation, ApiResponse,} from '@nestjs/swagger';
import {applyDecorators} from '@nestjs/common';
import {ForgotPasswordDto, LoginDto, RefreshTokenDto, ResetPasswordDto, VerifyEmailDto, VerifyResetTokenDto} from '../dto';

export const MasterAuthLoginDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Authenticate and obtain access token',
            description:
                'Logs in a master user using email and password. Returns an access token and user details.',
        }),
        ApiBody({
            description: 'Credentials for master user login',
            type: LoginDto,
            examples: {
                valid: {
                    summary: 'Valid login request example',
                    value: {
                        email: 'superadmin@system.com',
                        password: 'SuperSecure123!',
                    },
                },
                missingEmail: {
                    summary: 'Missing email field',
                    value: {
                        password: 'SuperSecure123!',
                    },
                },
                missingPassword: {
                    summary: 'Missing password field',
                    value: {
                        email: 'superadmin@system.com',
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
                    message: 'Login successful.',
                    user_type: 'master',
                    data: {
                        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        user: {
                            id: 1,
                            name: 'Super Admin',
                            email: 'superadmin@system.com',
                            role: 'Super Admin',
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

export const MasterAuthGetUserDocs = () =>
    applyDecorators(
        ApiBearerAuth('access-token'),
        ApiOperation({
            summary: 'Get authenticated user details',
            description:
                'Retrieves the currently logged-in master user’s profile based on the provided JWT token.',
        }),
        ApiResponse({
            status: 200,
            description: 'Authenticated user details',
            schema: {
                example: {
                    id: 1,
                    name: 'Super Admin',
                    email: 'superadmin@system.com',
                    role: 'Super Admin',
                    createdAt: '2025-11-10T10:22:30.000Z',
                    updatedAt: '2025-11-10T10:25:40.000Z',
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

export const MasterAuthForgotPasswordDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Send password reset email',
            description:
                'Generates a one-time password reset token and sends a reset email for an existing account.',
        }),
        ApiBody({
            type: ForgotPasswordDto,
            description: 'Email address for password reset.',
            examples: {
                valid: {
                    summary: 'Forgot password request',
                    value: {
                        email: 'superadmin@system.com',
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

export const MasterAuthVerifyResetTokenDocs = () =>
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
                        email: 'superadmin@system.com',
                        token: 'd11b0d6f84bb14d1470f6da0f5ea0de31fa53c53cb8bd0b37c2f67ff7d5a9f66',
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

export const MasterAuthResetPasswordDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Reset password',
            description:
                'Resets password using a valid one-time reset token. Token is invalidated immediately after success.',
        }),
        ApiBody({
            type: ResetPasswordDto,
            description: 'Email, reset token, and new password details.',
            examples: {
                valid: {
                    summary: 'Reset password request',
                    value: {
                        email: 'superadmin@system.com',
                        token: 'd11b0d6f84bb14d1470f6da0f5ea0de31fa53c53cb8bd0b37c2f67ff7d5a9f66',
                        password: 'NewStrongPassword123!',
                        password_confirm: 'NewStrongPassword123!',
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

export const MasterAuthEmailVerificationDocs = (mode: 'send' | 'verify') =>
    applyDecorators(
        ApiOperation({
            summary: mode === 'send' ? 'Send email verification link' : 'Verify email address',
            description:
                mode === 'send'
                    ? 'Generates a one-time email verification token and sends a verification email if the account exists.'
                    : 'Marks the account email as verified when a valid verification token is provided.',
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

export const MasterAuthRefreshTokenDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Rotate refresh token',
            description: 'Exchanges a valid refresh token for a new access token and a rotated refresh token.',
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
                    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
                    refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
                    expires_in: '2h',
                    refresh_expires_in_days: 7,
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Refresh token is invalid or expired.',
        }),
    );

export const MasterAuthLogoutDocs = () =>
    applyDecorators(
        ApiBearerAuth('access-token'),
        ApiOperation({
            summary: 'Logout master session',
            description:
                'Revokes the supplied refresh token for the authenticated master user. The current access token remains valid until it expires.',
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
