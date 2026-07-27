package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"monitor/backend/internal/domain"
)

// ResendAPIMailer sends via Resend's HTTPS API instead of SMTP. Many PaaS
// hosts (Render included) block outbound SMTP ports (25/587) to prevent
// abuse, which makes the go-mail SMTP path hang and time out in
// production even though it works fine from a local machine — HTTPS on
// 443 doesn't hit that restriction.
type ResendAPIMailer struct {
	apiKey   string
	from     string
	fromName string
	client   *http.Client
}

func NewResendAPI(apiKey, from, fromName string) *ResendAPIMailer {
	return &ResendAPIMailer{apiKey: apiKey, from: from, fromName: fromName, client: &http.Client{}}
}

func (m *ResendAPIMailer) Send(ctx context.Context, to, subject, htmlBody string) error {
	if m.apiKey == "" {
		return domain.ErrMailerNotConfigured
	}

	payload, err := json.Marshal(map[string]any{
		"from":    fmt.Sprintf("%s <%s>", m.fromName, m.from),
		"to":      []string{to},
		"subject": subject,
		"html":    htmlBody,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend api: status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

var _ domain.Mailer = (*ResendAPIMailer)(nil)
