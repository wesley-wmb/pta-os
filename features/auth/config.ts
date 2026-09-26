export function isSelfSignUpEnabled() {
  return process.env.PTA_AUTH_SIGN_UP_ENABLED === 'true';
}
