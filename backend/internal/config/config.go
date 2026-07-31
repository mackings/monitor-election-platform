package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            string
	MongoURI        string
	MongoDB         string
	JWTSecret       string
	JWTTTL          time.Duration
	R2Endpoint      string
	R2AccessKey     string
	R2SecretKey     string
	R2Bucket        string
	R2PublicBaseURL string
	CORSOrigins     []string
	SMTPHost        string
	SMTPPort        int
	SMTPUser        string
	SMTPPass        string
	SMTPFrom        string
	SMTPFromName    string
	AppURL          string
	LocationIQKey   string
	PUDataPath      string
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func Load() *Config {
	smtpPort, err := strconv.Atoi(envOr("SMTP_PORT", "587"))
	if err != nil {
		smtpPort = 587
	}
	return &Config{
		Port:            envOr("PORT", "8080"),
		MongoURI:        envOr("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:         envOr("MONGO_DB", "monitor"),
		JWTSecret:       envOr("JWT_SECRET", "dev-secret-change-me"),
		JWTTTL:          12 * time.Hour,
		R2Endpoint:      envOr("R2_ENDPOINT", ""),
		R2AccessKey:     envOr("R2_ACCESS_KEY", ""),
		R2SecretKey:     envOr("R2_SECRET_KEY", ""),
		R2Bucket:        envOr("R2_BUCKET", ""),
		R2PublicBaseURL: envOr("R2_PUBLIC_BASE_URL", ""),
		CORSOrigins:     []string{envOr("CORS_ORIGIN", "http://localhost:3000")},
		SMTPHost:        envOr("SMTP_HOST", ""),
		SMTPPort:        smtpPort,
		SMTPUser:        envOr("SMTP_USER", ""),
		SMTPPass:        envOr("SMTP_PASS", ""),
		SMTPFrom:        envOr("SMTP_FROM", ""),
		SMTPFromName:    envOr("SMTP_FROM_NAME", "Election Monitor"),
		AppURL:          envOr("APP_URL", "http://localhost:3002"),
		LocationIQKey:   envOr("LOCATIONIQ_API_KEY", ""),
		PUDataPath:      envOr("PU_DATA_PATH", "data/oyo_polling_units.json"),
	}
}
