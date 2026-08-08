package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"monitor/backend/internal/domain"
	"monitor/backend/pkg/hash"
	"monitor/backend/pkg/jwtutil"
)

const resetTokenTTL = time.Hour

type Usecase struct {
	users  domain.UserRepository
	pus    domain.PollingUnitRepository
	mailer domain.Mailer
	tokens *jwtutil.Manager
	appURL string
}

func New(users domain.UserRepository, pus domain.PollingUnitRepository, mailer domain.Mailer, tokens *jwtutil.Manager, appURL string) *Usecase {
	return &Usecase{users: users, pus: pus, mailer: mailer, tokens: tokens, appURL: appURL}
}

type LoginResult struct {
	Token string       `json:"token"`
	User  *domain.User `json:"user"`
}

func (u *Usecase) Login(ctx context.Context, username, password string) (*LoginResult, error) {
	// Trimmed defensively — a stray leading/trailing space (e.g. from
	// autofill or a copy-paste) would otherwise fail an exact-match lookup
	// with a misleading "invalid credentials" instead of just working.
	user, err := u.users.FindByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		return nil, domain.ErrUnauthorized
	}
	if !hash.Check(user.PasswordHash, password) {
		return nil, domain.ErrUnauthorized
	}
	// Checked after the password, not before -- a disabled account with a
	// correctly-typed password gets the specific "deactivated" message,
	// while a wrong password never confirms an account exists at all.
	if user.Disabled {
		return nil, domain.ErrAccountDisabled
	}
	token, err := u.tokens.Generate(user.ID, string(user.Role))
	if err != nil {
		return nil, err
	}
	return &LoginResult{Token: token, User: user}, nil
}

type CreateOfficerInput struct {
	Name           string
	Phone          string
	Email          string
	Role           domain.Role
	AssignedPUCode string
}

type CreateOfficerResult struct {
	User      *domain.User
	Username  string
	Password  string
	EmailSent bool
}

// CreateOfficer is admin-only: it generates login credentials for a new
// field officer/supervisor rather than requiring self-registration, and
// emails those credentials to the officer. The admin dialog still shows
// the password too (per product decision) as a fallback in case the email
// bounces or gets lost — email delivery failure never blocks account
// creation, it's just reported back via EmailSent.
func (u *Usecase) CreateOfficer(ctx context.Context, in CreateOfficerInput) (*CreateOfficerResult, error) {
	if in.Role == "" {
		in.Role = domain.RoleFieldOfficer
	}
	// Validated before creating anything — a typo'd PU code used to only
	// surface once AssignOfficer ran post-creation, leaving behind an
	// orphaned officer account with generated credentials nobody saw.
	if in.AssignedPUCode != "" {
		if _, err := u.pus.FindByCode(ctx, in.AssignedPUCode); err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return nil, fmt.Errorf("%w: no polling unit with code %q", domain.ErrNotFound, in.AssignedPUCode)
			}
			return nil, err
		}
	}
	username := generateUsername(in.Name)
	password, err := generatePassword()
	if err != nil {
		return nil, err
	}
	pwHash, err := hash.Hash(password)
	if err != nil {
		return nil, err
	}
	user := &domain.User{
		Name:           in.Name,
		Phone:          in.Phone,
		Email:          in.Email,
		Username:       username,
		PasswordHash:   pwHash,
		Role:           in.Role,
		AssignedPUCode: in.AssignedPUCode,
	}
	if err := u.users.Create(ctx, user); err != nil {
		return nil, err
	}
	// Keep the PU's back-reference in sync so the dashboard's "assigned
	// agent" lookup finds this officer immediately, not just after a
	// separate AssignPU call.
	if in.AssignedPUCode != "" {
		if err := u.pus.AssignOfficer(ctx, in.AssignedPUCode, user.ID); err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return nil, fmt.Errorf("%w: no polling unit with code %q", domain.ErrNotFound, in.AssignedPUCode)
			}
			return nil, err
		}
	}

	emailSent := false
	if in.Email != "" {
		err := u.mailer.Send(ctx, in.Email, "Your Election Monitor login", inviteEmailHTML(in.Name, username, password, u.appURL))
		switch {
		case err == nil:
			emailSent = true
		case errors.Is(err, domain.ErrMailerNotConfigured):
			// Expected before real SMTP credentials are set; the admin
			// dialog's credential fallback covers this case.
		default:
			log.Printf("auth: failed to email invite to %s: %v", in.Email, err)
		}
	}

	return &CreateOfficerResult{User: user, Username: username, Password: password, EmailSent: emailSent}, nil
}

// BulkOfficerRowResult reports one CSV row's outcome -- a bad row (unknown
// PU code, missing name) never aborts the rest of the batch, since an
// admin importing 200 agents shouldn't lose the other 199 because row 57
// had a typo.
type BulkOfficerRowResult struct {
	Row      int    `json:"row"`
	Name     string `json:"name"`
	Success  bool   `json:"success"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Error    string `json:"error,omitempty"`
}

// BulkCreateOfficers runs CreateOfficer once per row so every invariant it
// already enforces (PU-code validation, credential generation, the PU
// back-reference update, best-effort invite email) applies identically to
// a bulk import as to a single manual add -- this only adds the per-row
// isolation on top.
func (u *Usecase) BulkCreateOfficers(ctx context.Context, rows []CreateOfficerInput) []BulkOfficerRowResult {
	results := make([]BulkOfficerRowResult, len(rows))
	for i, in := range rows {
		row := i + 1
		if strings.TrimSpace(in.Name) == "" {
			results[i] = BulkOfficerRowResult{Row: row, Name: in.Name, Error: "name is required"}
			continue
		}
		result, err := u.CreateOfficer(ctx, in)
		if err != nil {
			results[i] = BulkOfficerRowResult{Row: row, Name: in.Name, Error: err.Error()}
			continue
		}
		results[i] = BulkOfficerRowResult{
			Row: row, Name: in.Name, Success: true, Username: result.Username, Password: result.Password,
		}
	}
	return results
}

const maxQuickAssignBatch = 200

type QuickAssignResult struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// QuickAssignBatch bulk-creates field officer accounts with no polling
// unit assigned on purpose: rather than an admin hand-assigning each one
// individually (the CreateOfficer/BulkCreateOfficers path), agents pick
// their own PU the first time they open the field app (see officer.
// Usecase.SelfAssignPU). Every account in a batch shares the one
// admin-typed password -- only the generated username tells them apart --
// so the admin can hand out a whole batch as a single printed/exported
// sheet rather than one credential pair at a time.
func (u *Usecase) QuickAssignBatch(ctx context.Context, count int, password string) ([]QuickAssignResult, error) {
	if count < 1 || count > maxQuickAssignBatch {
		return nil, fmt.Errorf("%w: count must be between 1 and %d", domain.ErrInvalidInput, maxQuickAssignBatch)
	}
	if len(password) < 8 {
		return nil, fmt.Errorf("%w: password must be at least 8 characters", domain.ErrInvalidInput)
	}
	pwHash, err := hash.Hash(password)
	if err != nil {
		return nil, err
	}

	results := make([]QuickAssignResult, 0, count)
	for i := 1; i <= count; i++ {
		username, err := u.uniqueQuickAssignUsername(ctx, i)
		if err != nil {
			return nil, err
		}
		user := &domain.User{
			Name:         username,
			Username:     username,
			PasswordHash: pwHash,
			Role:         domain.RoleFieldOfficer,
		}
		if err := u.users.Create(ctx, user); err != nil {
			return nil, err
		}
		results = append(results, QuickAssignResult{Username: username, Password: password})
	}
	return results, nil
}

// uniqueQuickAssignUsername generates "useragentN<xx>" (N = this account's
// sequential position in the batch, xx = a 2-letter random suffix) and
// retries with a fresh suffix on the rare chance it collides with a
// username from an earlier batch -- N alone repeats every batch (1..count
// again each time), so the suffix is what keeps usernames globally unique.
func (u *Usecase) uniqueQuickAssignUsername(ctx context.Context, n int) (string, error) {
	for attempt := 0; attempt < 5; attempt++ {
		suffix, err := randomLowerAlpha(2)
		if err != nil {
			return "", err
		}
		username := fmt.Sprintf("useragent%d%s", n, suffix)
		if _, err := u.users.FindByUsername(ctx, username); errors.Is(err, domain.ErrNotFound) {
			return username, nil
		}
	}
	return "", fmt.Errorf("could not generate a unique username after several attempts")
}

func randomLowerAlpha(n int) (string, error) {
	const alphabet = "abcdefghijklmnopqrstuvwxyz"
	b := make([]byte, n)
	for i := range b {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		b[i] = alphabet[idx.Int64()]
	}
	return string(b), nil
}

type SignupInput struct {
	Name     string
	Phone    string
	Email    string
	Username string
	Password string
}

// Signup is the public self-registration path — deliberately agent-only.
// Unlike CreateOfficer (admin-only, generates credentials), the caller
// picks their own username/password here. Role is never taken from the
// caller: hard-coding it to RoleFieldOfficer is what keeps this endpoint
// safe to leave open to the internet on a partisan-campaign tool where an
// admin account sees every agent's live location and distress alerts.
func (u *Usecase) Signup(ctx context.Context, in SignupInput) (*LoginResult, error) {
	// Trimmed before validation/storage — an untrimmed username here would
	// silently make that account impossible to log into later (an exact
	// -match lookup on "name " never matches typed input "name").
	in.Name = strings.TrimSpace(in.Name)
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.TrimSpace(in.Email)
	in.Phone = strings.TrimSpace(in.Phone)

	if in.Name == "" || in.Username == "" {
		return nil, domain.ErrInvalidInput
	}
	if len(in.Password) < 8 {
		return nil, domain.ErrInvalidInput
	}
	if _, err := u.users.FindByUsername(ctx, in.Username); err == nil {
		return nil, domain.ErrAlreadyExists
	}

	pwHash, err := hash.Hash(in.Password)
	if err != nil {
		return nil, err
	}
	user := &domain.User{
		Name:         in.Name,
		Phone:        in.Phone,
		Email:        in.Email,
		Username:     in.Username,
		PasswordHash: pwHash,
		Role:         domain.RoleFieldOfficer,
	}
	if err := u.users.Create(ctx, user); err != nil {
		return nil, err
	}

	token, err := u.tokens.Generate(user.ID, string(user.Role))
	if err != nil {
		return nil, err
	}
	return &LoginResult{Token: token, User: user}, nil
}

// ListAdmins backs the admin-only "Admins" page — reuses the same
// role-scoped repo listing that officer.Usecase.List uses for agents.
func (u *Usecase) ListAdmins(ctx context.Context) ([]*domain.User, error) {
	return u.users.List(ctx, domain.RoleAdmin)
}

// ChangePassword lets any authenticated user (admin or field officer)
// change their own password once logged in, given they can prove they
// know the current one.
func (u *Usecase) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	user, err := u.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if !hash.Check(user.PasswordHash, currentPassword) {
		return domain.ErrUnauthorized
	}
	newHash, err := hash.Hash(newPassword)
	if err != nil {
		return err
	}
	return u.users.UpdatePassword(ctx, userID, newHash)
}

// ForgotPassword looks the user up by username or email (whichever the
// caller typed) and, if found and they have an email on file, sends a
// reset link. It always returns nil regardless of whether a match was
// found — the handler always reports the same generic "check your email"
// message, so this endpoint can't be used to enumerate valid
// usernames/emails.
func (u *Usecase) ForgotPassword(ctx context.Context, usernameOrEmail string) error {
	usernameOrEmail = strings.TrimSpace(usernameOrEmail)
	user, err := u.users.FindByUsername(ctx, usernameOrEmail)
	if err != nil {
		user, err = u.users.FindByEmail(ctx, usernameOrEmail)
	}
	if err != nil || user.Email == "" {
		return nil
	}

	token, genErr := generateResetToken()
	if genErr != nil {
		return genErr
	}
	if err := u.users.SetResetToken(ctx, user.ID, token, time.Now().Add(resetTokenTTL)); err != nil {
		return err
	}

	sendErr := u.mailer.Send(ctx, user.Email, "Reset your Election Monitor password", resetEmailHTML(user.Name, token, u.appURL))
	if sendErr != nil && !errors.Is(sendErr, domain.ErrMailerNotConfigured) {
		log.Printf("auth: failed to email password reset to %s: %v", user.Email, sendErr)
	}
	return nil
}

// ResetPassword completes the forgot-password flow: a valid, unexpired
// token (looked up directly, never trusting a client-supplied user id)
// proves the caller controls the account's email.
func (u *Usecase) ResetPassword(ctx context.Context, token, newPassword string) error {
	if len(newPassword) < 8 {
		return domain.ErrInvalidInput
	}
	user, err := u.users.FindByResetToken(ctx, token)
	if err != nil {
		return domain.ErrUnauthorized
	}
	newHash, err := hash.Hash(newPassword)
	if err != nil {
		return err
	}
	return u.users.ResetPassword(ctx, user.ID, newHash)
}

func generateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func resetEmailHTML(name, token, appURL string) string {
	return fmt.Sprintf(`
		<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
			<h2>Password reset requested</h2>
			<p>Hi %s, we received a request to reset your Election Monitor password.</p>
			<p><a href="%s/reset-password?token=%s" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>
			<p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
		</div>
	`, name, appURL, token)
}

func inviteEmailHTML(name, username, password, appURL string) string {
	return fmt.Sprintf(`
		<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
			<h2>Welcome to Election Monitor, %s</h2>
			<p>An account has been created for you to report from your assigned polling unit.</p>
			<p style="background:#f4f4f5;border-radius:8px;padding:16px">
				<strong>Username:</strong> %s<br>
				<strong>Password:</strong> %s
			</p>
			<p><a href="%s/login" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in</a></p>
			<p style="color:#666;font-size:13px">For your security, please sign in and change this password from your account settings as soon as possible.</p>
		</div>
	`, name, username, password, appURL)
}

func generateUsername(name string) string {
	slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(name), " ", "."))
	suffix, _ := rand.Int(rand.Reader, big.NewInt(9000))
	return fmt.Sprintf("%s.%d", slug, 1000+suffix.Int64())
}

const passwordAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

func generatePassword() (string, error) {
	const length = 10
	b := make([]byte, length)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(passwordAlphabet))))
		if err != nil {
			return "", err
		}
		b[i] = passwordAlphabet[n.Int64()]
	}
	return string(b), nil
}
