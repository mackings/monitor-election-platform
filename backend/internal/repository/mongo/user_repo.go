package mongorepo

import (
	"context"
	"errors"
	"time"

	"monitor/backend/internal/domain"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type userDoc struct {
	ID                  bson.ObjectID        `bson:"_id,omitempty"`
	Name                string               `bson:"name"`
	Phone               string               `bson:"phone"`
	Email               string               `bson:"email,omitempty"`
	Username            string               `bson:"username"`
	PasswordHash        string               `bson:"password_hash"`
	Role                domain.Role          `bson:"role"`
	AssignedPUCode      string               `bson:"assigned_pu_code,omitempty"`
	Status              domain.OfficerStatus `bson:"status"`
	LastLocation        *domain.Location     `bson:"last_location,omitempty"`
	LastSeenAt          *time.Time           `bson:"last_seen_at,omitempty"`
	CreatedAt           time.Time            `bson:"created_at"`
	ResetToken          string               `bson:"reset_token,omitempty"`
	ResetTokenExpiresAt *time.Time           `bson:"reset_token_expires_at,omitempty"`
}

func (d *userDoc) toDomain() *domain.User {
	return &domain.User{
		ID:             d.ID.Hex(),
		Name:           d.Name,
		Phone:          d.Phone,
		Email:          d.Email,
		Username:       d.Username,
		PasswordHash:   d.PasswordHash,
		Role:           d.Role,
		AssignedPUCode: d.AssignedPUCode,
		Status:         d.Status,
		LastLocation:   d.LastLocation,
		LastSeenAt:     d.LastSeenAt,
		CreatedAt:      d.CreatedAt,
	}
}

type UserRepository struct {
	col *mongo.Collection
}

func NewUserRepository(db *mongo.Database) *UserRepository {
	return &UserRepository{col: db.Collection("users")}
}

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	doc := userDoc{
		ID:             bson.NewObjectID(),
		Name:           u.Name,
		Phone:          u.Phone,
		Email:          u.Email,
		Username:       u.Username,
		PasswordHash:   u.PasswordHash,
		Role:           u.Role,
		AssignedPUCode: u.AssignedPUCode,
		Status:         domain.OfficerOffline,
		CreatedAt:      time.Now(),
	}
	_, err := r.col.InsertOne(ctx, doc)
	if err != nil {
		return err
	}
	u.ID = doc.ID.Hex()
	u.CreatedAt = doc.CreatedAt
	u.Status = doc.Status
	return nil
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	var doc userDoc
	err := r.col.FindOne(ctx, bson.M{"username": username}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var doc userDoc
	err := r.col.FindOne(ctx, bson.M{"email": email}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, domain.ErrNotFound
	}
	var doc userDoc
	err = r.col.FindOne(ctx, bson.M{"_id": oid}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (r *UserRepository) List(ctx context.Context, role domain.Role) ([]*domain.User, error) {
	filter := bson.M{}
	if role != "" {
		filter["role"] = role
	}
	cur, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	users := []*domain.User{}
	for cur.Next(ctx) {
		var doc userDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		users = append(users, doc.toDomain())
	}
	return users, cur.Err()
}

func (r *UserRepository) UpdateAssignment(ctx context.Context, userID, puCode string) error {
	oid, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		return domain.ErrNotFound
	}
	_, err = r.col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": bson.M{"assigned_pu_code": puCode}})
	return err
}

func (r *UserRepository) UpdatePassword(ctx context.Context, userID, newPasswordHash string) error {
	oid, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		return domain.ErrNotFound
	}
	_, err = r.col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": bson.M{"password_hash": newPasswordHash}})
	return err
}

func (r *UserRepository) SetResetToken(ctx context.Context, userID, token string, expiresAt time.Time) error {
	oid, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		return domain.ErrNotFound
	}
	_, err = r.col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": bson.M{
		"reset_token":            token,
		"reset_token_expires_at": expiresAt,
	}})
	return err
}

func (r *UserRepository) FindByResetToken(ctx context.Context, token string) (*domain.User, error) {
	var doc userDoc
	err := r.col.FindOne(ctx, bson.M{
		"reset_token":            token,
		"reset_token_expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (r *UserRepository) ResetPassword(ctx context.Context, userID, newPasswordHash string) error {
	oid, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		return domain.ErrNotFound
	}
	_, err = r.col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$set":   bson.M{"password_hash": newPasswordHash},
		"$unset": bson.M{"reset_token": "", "reset_token_expires_at": ""},
	})
	return err
}

func (r *UserRepository) UpdateStatus(ctx context.Context, userID string, status domain.OfficerStatus, loc *domain.Location) error {
	oid, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		return domain.ErrNotFound
	}
	now := time.Now()
	set := bson.M{"status": status, "last_seen_at": now}
	if loc != nil {
		set["last_location"] = loc
	}
	_, err = r.col.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{"$set": set})
	return err
}
