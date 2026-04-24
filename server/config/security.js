const isProduction = process.env.NODE_ENV === 'production';

function parseBoolean(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }

    return String(value).trim().toLowerCase() === 'true';
}

function parseInteger(value, defaultValue) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'fallback_secret_do_not_use_in_prod');

const securityConfig = {
    isProduction,
    jwtSecret,
    publicSignupEnabled: parseBoolean(process.env.PUBLIC_SIGNUP_ENABLED, true),
    guestAccountsEnabled: parseBoolean(process.env.GUEST_ACCOUNTS_ENABLED, !isProduction),
    signupEmailRequired: parseBoolean(process.env.SIGNUP_EMAIL_REQUIRED, isProduction),
    minPasswordLength: parseInteger(process.env.MIN_PASSWORD_LENGTH, 10),
    signupBurstLimit: parseInteger(process.env.SIGNUP_BURST_LIMIT, 2),
    signupDailyLimit: parseInteger(process.env.SIGNUP_DAILY_LIMIT, 5)
};

function ensureCriticalSecurityConfig() {
    if (!securityConfig.jwtSecret) {
        throw new Error('JWT_SECRET must be configured before starting the server in production.');
    }
}

module.exports = {
    ...securityConfig,
    ensureCriticalSecurityConfig
};
