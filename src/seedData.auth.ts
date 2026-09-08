// SERVER-ONLY seed credential store — imported by src/apiApp.ts only,
// never by App.tsx or any component. Keeping this out of seedData.ts
// (which the client bundle also imports for its optimistic initial render)
// means no credential ever ships to the browser.
//
// DEMO-ONLY: every value below is a fixed, hardcoded literal — not hashed,
// not randomly generated, not stored in any Map or other state that has to
// survive between requests. That's deliberate. Vercel serverless functions
// don't guarantee two requests in the same login flow (POST /login, then
// POST /otp/send, then POST /otp/verify) land on the same warm instance, so
// anything held in a module-level Map — a generated OTP code, a password
// reset token — can vanish between steps on a cold start. Hardcoding every
// credential and OTP code as a fixed literal here removes that entire class
// of failure for this demo. See SECURITY.md for what a real deployment
// needs instead (persistent store, per-session generated OTP, hashed
// passwords).
//
// Each staff member has their own distinct password and their own distinct
// fixed OTP code — see the table below for the full list.
export const SEED_USERNAMES: Record<string, string> = {
  'staff-sarah': 'sarah.jenkins',
  'staff-dave': 'dave.tremblett',
  'staff-mary': 'mary.power',
  'staff-olatundun': 'olatundun.ndudim',
  'staff-derrick': 'derrick.pike',
};

// Username / password / OTP code per staff member:
//   sarah.jenkins       / Sarah#2024      / 111111
//   dave.tremblett      / Dave#2024       / 222222
//   mary.power          / Mary#2024       / 333333
//   olatundun.ndudim    / Olatundun#2024  / 444444
//   derrick.pike        / Derrick#2024    / 555555
export const SEED_PASSWORDS: Record<string, string> = {
  'staff-sarah': 'Sarah#2024',
  'staff-dave': 'Dave#2024',
  'staff-mary': 'Mary#2024',
  'staff-olatundun': 'Olatundun#2024',
  'staff-derrick': 'Derrick#2024',
};

export const SEED_OTP_CODES: Record<string, string> = {
  'staff-sarah': '111111',
  'staff-dave': '222222',
  'staff-mary': '333333',
  'staff-olatundun': '444444',
  'staff-derrick': '555555',
};
