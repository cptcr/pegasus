interface defaultConfigInterface {
    skipBuiltInValidations: boolean;
    bulkRegister: boolean;
}

/**
 * Server-IDs for development testing
 * Add your Discord server IDs here for testing commands
 */
export const devGuilds: string[] = [
    '554266392262737930', // Example Server 1 
    '987654321098765432', // Example Server 2
];

/**
 * Role-IDs for development/admin access
 * Add Discord role IDs that should have admin access
 */
export const devRoles: string[] = [
    '554266392262737940', // Admin Role
    '554266392262737941', // Moderator Role
];

/**
 * User-IDs for development/admin access
 * Add Discord user IDs that should have admin access
 */
export const devUsers: string[] = [
    '797927858420187186', // Main Admin
    '123456789012345678', // Secondary Admin
];

/**
 * Default configuration for CommandKit
 */
export const defaultConfig: defaultConfigInterface = {
    skipBuiltInValidations: true,
    bulkRegister: true
}