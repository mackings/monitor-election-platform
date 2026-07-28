package domain

import (
	"context"
	"time"
)

type Role string

const (
	RoleAdmin        Role = "admin"
	RoleSupervisor   Role = "supervisor"
	RoleFieldOfficer Role = "field_officer"
)

type OfficerStatus string

const (
	OfficerOffline  OfficerStatus = "offline"
	OfficerActive   OfficerStatus = "active"
	OfficerDistress OfficerStatus = "distress"
)

type Location struct {
	Lat float64 `bson:"lat" json:"lat"`
	Lng float64 `bson:"lng" json:"lng"`
}

type User struct {
	ID             string        `bson:"_id,omitempty" json:"id"`
	Name           string        `bson:"name" json:"name"`
	Phone          string        `bson:"phone" json:"phone"`
	Email          string        `bson:"email,omitempty" json:"email,omitempty"`
	Username       string        `bson:"username" json:"username"`
	PasswordHash   string        `bson:"password_hash" json:"-"`
	Role           Role          `bson:"role" json:"role"`
	AssignedPUCode string        `bson:"assigned_pu_code,omitempty" json:"assigned_pu_code,omitempty"`
	Status         OfficerStatus `bson:"status" json:"status"`
	LastLocation   *Location     `bson:"last_location,omitempty" json:"last_location,omitempty"`
	LastSeenAt     *time.Time    `bson:"last_seen_at,omitempty" json:"last_seen_at,omitempty"`
	CreatedAt      time.Time     `bson:"created_at" json:"created_at"`
}

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	FindByUsername(ctx context.Context, username string) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id string) (*User, error)
	List(ctx context.Context, role Role) ([]*User, error)
	UpdateAssignment(ctx context.Context, userID, puCode string) error
	UpdateStatus(ctx context.Context, userID string, status OfficerStatus, loc *Location) error
	// UpdateLocation records a live position ping without touching status —
	// distinct from UpdateStatus so a background location update (sent every
	// ~25s while an officer is checked in) can never accidentally revert a
	// distress/offline transition that raced it.
	UpdateLocation(ctx context.Context, userID string, loc Location) error
	UpdatePassword(ctx context.Context, userID, newPasswordHash string) error
	// SetResetToken/FindByResetToken/ResetPassword back the forgot-password
	// flow. The token and its expiry are stored only on the Mongo document
	// (never mapped onto the shared User struct) so they can never leak
	// through an API response the way PasswordHash could if it lacked its
	// json:"-" tag.
	SetResetToken(ctx context.Context, userID, token string, expiresAt time.Time) error
	FindByResetToken(ctx context.Context, token string) (*User, error)
	ResetPassword(ctx context.Context, userID, newPasswordHash string) error
}
