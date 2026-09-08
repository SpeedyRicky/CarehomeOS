// SERVER-ONLY seed credential store — imported by src/apiApp.ts only,
// never by App.tsx or any component. Keeping this out of seedData.ts
// (which the client bundle also imports for its optimistic initial render)
// means no password hash ever ships to the browser.
//
// In production this maps to a `staff_credentials` table: one row per staff
// member holding a scrypt password hash, never plain seed literals like
// this. Rotate/replace all of the below before any real deployment — see
// SECURITY.md "Credential Rotation".
//
// Demo password for every seeded account: demo123
export const SEED_USERNAMES: Record<string, string> = {
  'staff-sarah': 'sarah.jenkins',
  'staff-dave': 'dave.tremblett',
  'staff-mary': 'mary.power',
  'staff-olatundun': 'olatundun.ndudim',
  'staff-derrick': 'derrick.pike',
};

export const SEED_PASSWORD_HASHES: Record<string, string> = {
  'staff-sarah':
    'bb280e81e9a52cdf75bda709dbbdfa7d:c81f232a75305f270fb4f09ab0f50c09599947617ae5776600ad7748fb012313594f1f1d1931c5b95a43e14241a4cd124adbe9af62cf2e2cfd988e3b53c582de',
  'staff-dave':
    '59f140198899405155161cdf472b7fc1:d5056fe6a3832fc82964f8ac179384fb2fe73771fb06ce787e9a68a5d68b94cfedfa819542ea911c802c367e17bd8fa36224f7aeebbe9b92a4e868b77ee4dde5',
  'staff-mary':
    'a0bbe7070ba3e44ad698400af5e7fab8:6e3cbef890109bc2dad47e1a1bacf6fa5ebdc506b54673ec8449de2e66839b21eaae434ddbd6e7c6c177602bc4492b123a8d40a803a28691abae0f6a06a7ebd2',
  'staff-olatundun':
    '82272fa830fad270b051356daec9fccb:8a73d8bc442a3104fbc81d32277877f8cadff2740b7c325a1801d8d7f1a68afd987ff9e2b611cd526b4698ab490d7074fa3bd9ebc03f8b83e7f88f28ab4dfe29',
  'staff-derrick':
    '7f000359e128d234f0a09e6bb36cf8e4:39d8e6e319eb760548117041432ae304a62244964fa7dd62dc19a3f36d2b001bbe2daa2bf93c408d5d2fc8f684424f2248cf5cfeaddba3a927af30d1e3ffa207',
};

// Whether a seeded account still needs to change its password on next
// login. All demo accounts start false since `demo123` is already a
// "chosen" password for this prototype — a real provisioning flow would
// seed these as true with a generateTemporaryPassword() value instead.
export const SEED_MUST_CHANGE_PASSWORD: Record<string, boolean> = {
  'staff-sarah': false,
  'staff-dave': false,
  'staff-mary': false,
  'staff-olatundun': false,
  'staff-derrick': false,
};
