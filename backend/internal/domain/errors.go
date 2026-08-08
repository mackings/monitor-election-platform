package domain

import "errors"

var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrInvalidInput  = errors.New("invalid input")
	// ErrConflict is for a request that's individually well-formed but
	// clashes with the current state of something else (e.g. a polling
	// unit another agent just claimed a moment ago).
	ErrConflict = errors.New("conflict")
	// ErrAccountDisabled lets Login report a deactivated account
	// distinctly from a wrong username/password, so the person sees "your
	// account was deactivated" instead of assuming they mistyped it.
	ErrAccountDisabled = errors.New("account disabled")
)
