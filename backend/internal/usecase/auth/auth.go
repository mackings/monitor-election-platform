package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"

	"monitor/backend/internal/domain"
	"monitor/backend/pkg/hash"
	"monitor/backend/pkg/jwtutil"
)

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
	user, err := u.users.FindByUsername(ctx, username)
	if err != nil {
		return nil, domain.ErrUnauthorized
	}
	if !hash.Check(user.PasswordHash, password) {
		return nil, domain.ErrUnauthorized
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
