// SERVER-ONLY seed credential store — imported by server.ts only, never by
// App.tsx or any component. Keeping this out of seedData.ts (which the
// client bundle also imports for its optimistic initial render) means no
// password hash ever ships to the browser.
//
// In production this maps to a `staff_credentials_auth` table: one row per
// staff member holding a scrypt password hash and MFA enrollment secret,
// never plain seed literals like this. Rotate/replace all of the below
// before any real deployment — see SECURITY.md "Credential Rotation".
//
// Demo password for every seeded account: Demo@CareHome1
export const SEED_PASSWORD_HASHES: Record<string, string> = {
  'staff-olatundun':
    'b6a57139e6bc60ac7728ffd06ac11e8a:97d5191683ab06ac45d6942914ec4dcb98cbda7a0cf4bd6c72c8424e3849beef15984b8fbc1205e044334711326d7585005e7ba2aa5c4a6a031c61f35378d445',
  'staff-derrick':
    '652ebaffd642e5eda398b2fc3ba540a2:06a52669c3dc2eed2f02fb14806cfba99c3abb9e6d2f687a7eefc54d670bf4a192fbcf2beb74dd0cd2b821acd6df52b8e6e532af51ab28b0fec816624d8ee924',
  'staff-linda':
    '443140dbd5153c70c05190bd16775f45:4a69c17542f7692e26569bf1bd75c1c0b504f365a84220f03ac59d1f77171875d6a411d931476843cb78d60a6d6d3b3348c57979caa04dc293173a3fb1dc06a9',
  'staff-sarah':
    '9e78586e5946c9dd64e4686f9c0ab5de:4c76746883d152a2e192d3df9d2acd1211f76282e839dd87a86fe372df4c3042ac6ec2181a77ca2c7c13fc1725fb0cf1e103aec4d5a6692b79b106e84a0ec8b9',
  'staff-dave':
    '0285c7e9ae18ebbcef219c19f22a68bf:9caec43694086914d2c0c9cd2dcc6827d988f6d7db5ebcc6a4dd1cdb32b9b22c496e1695d90cd63d65e33a85f85871605c2a1f775d4e6e03c2276479675c1c73',
  'staff-mary':
    '62a2f9a24e3d6784eba288cf18ef2651:652517a817b182650a653600640f52b81b5a393dc0fb4d189936f742f2a3d4f0dbcd31dd96c364e6f54312fd37bc6f926e1f39ee6ec9530517d6944f077dbc39',
};

// Demo-only MFA stand-in: accounts with `mfa_enabled: true` (all seeded
// accounts) must submit this code as the second factor. Replace with a real
// TOTP (authenticator app) or SMS/push provider (e.g., Twilio Verify) before
// production use — see SECURITY.md "Authentication & MFA".
export const SEED_MFA_DEMO_CODE = '123456';
