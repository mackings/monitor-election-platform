package domain

import (
	"context"
	"errors"
)

// Mailer decouples usecases from the actual email transport (SMTP, an HTTP
// API, whatever). The delivery/storage layer implements this; usecases
// only ever depend on this interface.
type Mailer interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}

// ErrMailerNotConfigured is returned by Send when no real transport is
// configured yet, so callers can distinguish "not set up" (expected during
// development) from a genuine delivery failure.
var ErrMailerNotConfigured = errors.New("mailer: not configured")
