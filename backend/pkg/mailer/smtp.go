// Package mailer sends outbound email via any standard SMTP account
// (Gmail, Brevo, Resend, a company mailbox, ...) — the provider is just
// config, not code.
package mailer

import (
	"context"
	"log"

	"monitor/backend/internal/domain"

	gomail "github.com/wneessen/go-mail"
)

type Config struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	FromName string
}

// SMTPMailer implements domain.Mailer. If Host is empty (no credentials
// configured yet), Send logs and no-ops instead of failing — so features
// that send email (like officer invites) keep working end-to-end during
// development before a real SMTP account is wired up.
type SMTPMailer struct {
	cfg Config
}

func NewSMTP(cfg Config) *SMTPMailer {
	return &SMTPMailer{cfg: cfg}
}

func (m *SMTPMailer) Send(ctx context.Context, to, subject, htmlBody string) error {
	if m.cfg.Host == "" {
		log.Printf("mailer: SMTP not configured, skipping email to %s (subject: %q)", to, subject)
		return domain.ErrMailerNotConfigured
	}

	msg := gomail.NewMsg()
	if err := msg.FromFormat(m.cfg.FromName, m.cfg.From); err != nil {
		return err
	}
	if err := msg.To(to); err != nil {
		return err
	}
	msg.Subject(subject)
	msg.SetBodyString(gomail.TypeTextHTML, htmlBody)

	client, err := gomail.NewClient(
		m.cfg.Host,
		gomail.WithPort(m.cfg.Port),
		gomail.WithSMTPAuth(gomail.SMTPAuthPlain),
		gomail.WithUsername(m.cfg.Username),
		gomail.WithPassword(m.cfg.Password),
		gomail.WithTLSPolicy(gomail.TLSMandatory),
	)
	if err != nil {
		return err
	}

	return client.DialAndSendWithContext(ctx, msg)
}

var _ domain.Mailer = (*SMTPMailer)(nil)
