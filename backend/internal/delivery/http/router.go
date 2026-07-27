package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"monitor/backend/internal/delivery/http/handler"
	appmw "monitor/backend/internal/delivery/http/middleware"
	"monitor/backend/internal/domain"
	"monitor/backend/pkg/jwtutil"
)

type Handlers struct {
	Auth        *handler.AuthHandler
	Officer     *handler.OfficerHandler
	PollingUnit *handler.PollingUnitHandler
	Incident    *handler.IncidentHandler
	Media       *handler.MediaHandler
	Collation   *handler.CollationHandler
	Activity    *handler.ActivityHandler
	WS          *handler.WSHandler
}

func NewRouter(h Handlers, tokens *jwtutil.Manager, corsOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	r.Get("/ws", h.WS.Serve)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", h.Auth.Login)
		r.Post("/auth/signup", h.Auth.Signup)

		r.Group(func(r chi.Router) {
			r.Use(appmw.Auth(tokens))

			// Admin only
			r.Group(func(r chi.Router) {
				r.Use(appmw.RequireRole(domain.RoleAdmin))
				r.Get("/admins", h.Auth.ListAdmins)
			})

			// Admin / supervisor only
			r.Group(func(r chi.Router) {
				r.Use(appmw.RequireRole(domain.RoleAdmin, domain.RoleSupervisor))
				r.Post("/officers", h.Auth.CreateOfficer)
				r.Get("/officers", h.Officer.List)
				r.Post("/officers/assign", h.Officer.Assign)
			})

			// Any authenticated user
			r.Post("/auth/change-password", h.Auth.ChangePassword)
			r.Get("/polling-units", h.PollingUnit.List)
			r.Get("/polling-units/overview", h.PollingUnit.Overview)
			r.Get("/polling-units/{code}", h.PollingUnit.Get)
			r.Get("/incidents", h.Incident.List)
			r.Get("/results/tally", h.Collation.Tally)
			r.Get("/activity", h.Activity.List)
			r.Get("/media", h.Media.List)

			// Field officer actions
			r.Group(func(r chi.Router) {
				r.Use(appmw.RequireRole(domain.RoleFieldOfficer))
				r.Post("/officer/checkin", h.Officer.CheckIn)
				r.Post("/officer/checkout", h.Officer.CheckOut)
				r.Post("/officer/status", h.Officer.UpdateStatus)
				r.Post("/officer/distress", h.Officer.Distress)
				r.Post("/incidents", h.Incident.Create)
				r.Post("/results", h.Collation.Submit)
			})

			r.Post("/media/presign", h.Media.Presign)
			r.Post("/media/register", h.Media.Register)
		})
	})

	return r
}
