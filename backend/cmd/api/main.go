package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"monitor/backend/internal/config"
	"monitor/backend/internal/delivery/broadcast"
	apphttp "monitor/backend/internal/delivery/http"
	"monitor/backend/internal/delivery/http/handler"
	"monitor/backend/internal/delivery/ws"
	"monitor/backend/internal/domain"
	mongorepo "monitor/backend/internal/repository/mongo"
	"monitor/backend/internal/repository/storage"
	"monitor/backend/internal/usecase/activity"
	"monitor/backend/internal/usecase/auth"
	"monitor/backend/internal/usecase/collation"
	"monitor/backend/internal/usecase/incident"
	"monitor/backend/internal/usecase/media"
	"monitor/backend/internal/usecase/officer"
	"monitor/backend/internal/usecase/pollingunit"
	"monitor/backend/pkg/geocode"
	"monitor/backend/pkg/jwtutil"
	"monitor/backend/pkg/mailer"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	db, disconnect, err := mongorepo.Connect(cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer disconnect(context.Background())

	userRepo := mongorepo.NewUserRepository(db)
	puRepo := mongorepo.NewPollingUnitRepository(db)
	if err := puRepo.EnsureIndexes(context.Background()); err != nil {
		log.Fatalf("ensure indexes: %v", err)
	}
	statusEventRepo := mongorepo.NewStatusEventRepository(db)
	incidentRepo := mongorepo.NewIncidentRepository(db)
	mediaRepo := mongorepo.NewMediaRepository(db)
	resultRepo := mongorepo.NewResultRepository(db)
	activityRepo := mongorepo.NewActivityRepository(db)
	if err := activityRepo.EnsureIndexes(context.Background()); err != nil {
		log.Fatalf("ensure activity indexes: %v", err)
	}

	objectStore, err := storage.NewR2Store(cfg.R2Endpoint, cfg.R2AccessKey, cfg.R2SecretKey, cfg.R2Bucket, cfg.R2PublicBaseURL)
	if err != nil {
		log.Fatalf("r2 connect: %v", err)
	}

	// Resend specifically goes over its HTTPS API rather than SMTP: many
	// PaaS hosts (Render included) block outbound SMTP ports (25/587) to
	// prevent abuse, which makes SMTP delivery hang and time out in
	// production even though it works fine from a local machine.
	var mail domain.Mailer
	if cfg.SMTPHost == "smtp.resend.com" {
		mail = mailer.NewResendAPI(cfg.SMTPPass, cfg.SMTPFrom, cfg.SMTPFromName)
	} else {
		mail = mailer.NewSMTP(mailer.Config{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			Username: cfg.SMTPUser,
			Password: cfg.SMTPPass,
			From:     cfg.SMTPFrom,
			FromName: cfg.SMTPFromName,
		})
	}

	hub := ws.NewHub()
	// Usecases publish through this decorator, which persists every event
	// to the activity log before/alongside delivering it live over WS —
	// that's what makes the dashboard's feed survive a page refresh.
	broadcaster := broadcast.NewPersisting(hub, activityRepo)
	tokens := jwtutil.NewManager(cfg.JWTSecret, cfg.JWTTTL)

	authUC := auth.New(userRepo, puRepo, mail, tokens, cfg.AppURL)
	officerUC := officer.New(userRepo, puRepo, statusEventRepo, broadcaster, hub)
	puUC := pollingunit.New(puRepo)
	incidentUC := incident.New(incidentRepo, puRepo, broadcaster)
	mediaUC := media.New(objectStore, mediaRepo)
	collationUC := collation.New(resultRepo, broadcaster)
	activityUC := activity.New(activityRepo)

	handlers := apphttp.Handlers{
		Auth:        handler.NewAuthHandler(authUC),
		Officer:     handler.NewOfficerHandler(officerUC),
		PollingUnit: handler.NewPollingUnitHandler(puUC),
		Incident:    handler.NewIncidentHandler(incidentUC),
		Media:       handler.NewMediaHandler(mediaUC),
		Collation:   handler.NewCollationHandler(collationUC),
		Activity:    handler.NewActivityHandler(activityUC),
		Geo:         handler.NewGeoHandler(geocode.NewClient(cfg.LocationIQKey)),
		WS:          handler.NewWSHandler(hub, tokens),
	}

	router := apphttp.NewRouter(handlers, tokens, cfg.CORSOrigins)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("api listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	log.Println("api stopped")
}
