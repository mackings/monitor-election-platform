package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"monitor/backend/internal/domain"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/cors"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const presignExpiry = 15 * time.Minute

// R2Store implements domain.ObjectStore against a Cloudflare R2 bucket via
// its S3-compatible API. Clients upload directly via the presigned URL;
// the API never proxies file bytes. Public reads go through R2's public
// bucket URL (r2.dev or a custom domain) rather than signed GETs, since
// incident/result evidence just needs to render in <img>/<video> tags and
// the app already gates access to the pages that reference it.
type R2Store struct {
	client        *minio.Client
	bucket        string
	publicBaseURL string
}

func NewR2Store(endpoint, accessKey, secretKey, bucket, publicBaseURL string) (*R2Store, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: true,
		Region: "auto",
	})
	if err != nil {
		return nil, err
	}
	store := &R2Store{
		client:        client,
		bucket:        bucket,
		publicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}
	if err := store.ensureCORS(context.Background()); err != nil {
		return nil, err
	}
	return store, nil
}

// ensureCORS lets the browser upload straight to R2 via a presigned URL.
// Presigned URLs carry their own auth in the query string (not cookies),
// so a wildcard origin here doesn't widen access to anything.
func (s *R2Store) ensureCORS(ctx context.Context) error {
	return s.client.SetBucketCors(ctx, s.bucket, cors.NewConfig([]cors.Rule{
		{
			AllowedOrigin: []string{"*"},
			AllowedMethod: []string{"GET", "PUT", "HEAD"},
			AllowedHeader: []string{"*"},
			MaxAgeSeconds: 3000,
		},
	}))
}

func (s *R2Store) PresignPutURL(ctx context.Context, objectKey, contentType string) (*domain.PresignedUpload, error) {
	u, err := s.client.PresignedPutObject(ctx, s.bucket, objectKey, presignExpiry)
	if err != nil {
		return nil, err
	}
	return &domain.PresignedUpload{
		UploadURL: u.String(),
		ObjectKey: objectKey,
		PublicURL: s.PublicURL(objectKey),
		ExpiresIn: int(presignExpiry.Seconds()),
	}, nil
}

func (s *R2Store) PublicURL(objectKey string) string {
	return fmt.Sprintf("%s/%s", s.publicBaseURL, objectKey)
}
