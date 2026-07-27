package media

import (
	"context"
	"fmt"
	"time"

	"monitor/backend/internal/domain"

	"github.com/google/uuid"
)

type Usecase struct {
	store domain.ObjectStore
	media domain.MediaRepository
}

func New(store domain.ObjectStore, media domain.MediaRepository) *Usecase {
	return &Usecase{store: store, media: media}
}

// Presign issues a direct-to-storage upload URL. The caller registers the
// resulting object key against an incident/result once the upload succeeds.
func (u *Usecase) Presign(ctx context.Context, uploaderID, contentType string) (*domain.PresignedUpload, error) {
	ext := extensionFor(contentType)
	objectKey := fmt.Sprintf("%s/%s%s", time.Now().Format("2006/01/02"), uuid.NewString(), ext)
	return u.store.PresignPutURL(ctx, objectKey, contentType)
}

type RegisterInput struct {
	ObjectKey   string
	ContentType string
	UploadedBy  string
	RelatedType domain.RelatedType
	RelatedID   string
}

func (u *Usecase) Register(ctx context.Context, in RegisterInput) (*domain.Media, error) {
	m := &domain.Media{
		ObjectKey:   in.ObjectKey,
		URL:         u.store.PublicURL(in.ObjectKey),
		ContentType: in.ContentType,
		UploadedBy:  in.UploadedBy,
		RelatedType: in.RelatedType,
		RelatedID:   in.RelatedID,
	}
	if err := u.media.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// GetMany resolves a batch of media IDs (e.g. an incident's or result's
// media_ids) to their viewable URLs in one call.
func (u *Usecase) GetMany(ctx context.Context, ids []string) ([]*domain.Media, error) {
	return u.media.FindByIDs(ctx, ids)
}

func extensionFor(contentType string) string {
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "video/mp4":
		return ".mp4"
	default:
		return ""
	}
}
