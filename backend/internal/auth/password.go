package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// ErrPasswordInvalid is returned for both "user not found" and "wrong
// password" so the password sign-in endpoint cannot be used to
// enumerate accounts.
var ErrPasswordInvalid = errors.New("invalid credentials")

// TestUserCreds carries the seeded password account in memory. The
// password hash is computed once at boot from TEST_USER_PASSWORD and
// never written to the database — there is only ever one such account
// (the App Store reviewer + CI tester), so the env var is the source
// of truth and a separate password_credentials table would just drift
// out of sync with secret rotations.
type TestUserCreds struct {
	Email string
	Hash  []byte
}

// Verify constant-time-checks the supplied password against the
// pre-computed bcrypt hash. Returns ErrPasswordInvalid on any
// mismatch.
func (c *TestUserCreds) Verify(password string) error {
	if err := bcrypt.CompareHashAndPassword(c.Hash, []byte(password)); err != nil {
		return ErrPasswordInvalid
	}
	return nil
}

// hashPassword runs bcrypt at the default cost. Internal because the
// only caller is the boot-time seeder.
func hashPassword(password string) ([]byte, error) {
	return bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
}
