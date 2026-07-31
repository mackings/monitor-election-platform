package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"monitor/backend/internal/delivery/http/middleware"
	"monitor/backend/internal/domain"
	"monitor/backend/internal/usecase/auth"
	"monitor/backend/pkg/httpresp"
)

type AuthHandler struct {
	auth *auth.Usecase
}

func NewAuthHandler(a *auth.Usecase) *AuthHandler {
	return &AuthHandler{auth: a}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	result, err := h.auth.Login(r.Context(), body.Username, body.Password)
	if err != nil {
		httpresp.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	httpresp.JSON(w, http.StatusOK, result)
}

func (h *AuthHandler) CreateOfficer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name           string      `json:"name"`
		Phone          string      `json:"phone"`
		Email          string      `json:"email"`
		Role           domain.Role `json:"role"`
		AssignedPUCode string      `json:"assigned_pu_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Name == "" {
		httpresp.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	// Creating another admin is restricted to callers who are themselves
	// admins — supervisors can still create field officers/supervisors,
	// but shouldn't be able to mint new admin accounts.
	if body.Role == domain.RoleAdmin && middleware.UserRole(r.Context()) != string(domain.RoleAdmin) {
		httpresp.Error(w, http.StatusForbidden, "only an admin can invite another admin")
		return
	}
	result, err := h.auth.CreateOfficer(r.Context(), auth.CreateOfficerInput{
		Name: body.Name, Phone: body.Phone, Email: body.Email, Role: body.Role, AssignedPUCode: body.AssignedPUCode,
	})
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpresp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusCreated, result)
}

func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Phone    string `json:"phone"`
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	result, err := h.auth.Signup(r.Context(), auth.SignupInput{
		Name: body.Name, Phone: body.Phone, Email: body.Email, Username: body.Username, Password: body.Password,
	})
	if err != nil {
		switch err {
		case domain.ErrInvalidInput:
			httpresp.Error(w, http.StatusBadRequest, "name, username and a password of at least 8 characters are required")
		case domain.ErrAlreadyExists:
			httpresp.Error(w, http.StatusConflict, "username is already taken")
		default:
			httpresp.Error(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	httpresp.JSON(w, http.StatusCreated, result)
}

func (h *AuthHandler) ListAdmins(w http.ResponseWriter, r *http.Request) {
	admins, err := h.auth.ListAdmins(r.Context())
	if err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, admins)
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UsernameOrEmail string `json:"username_or_email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.auth.ForgotPassword(r.Context(), body.UsernameOrEmail); err != nil {
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Always the same response, whether or not an account was found — this
	// endpoint must not reveal which usernames/emails exist.
	httpresp.JSON(w, http.StatusOK, map[string]string{
		"status": "if an account with that username or email exists, a reset link has been sent",
	})
}

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.auth.ResetPassword(r.Context(), body.Token, body.NewPassword); err != nil {
		switch err {
		case domain.ErrInvalidInput:
			httpresp.Error(w, http.StatusBadRequest, "new password must be at least 8 characters")
		case domain.ErrUnauthorized:
			httpresp.Error(w, http.StatusUnauthorized, "reset link is invalid or has expired")
		default:
			httpresp.Error(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "password_reset"})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpresp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.NewPassword) < 8 {
		httpresp.Error(w, http.StatusBadRequest, "new password must be at least 8 characters")
		return
	}
	userID := middleware.UserID(r.Context())
	if err := h.auth.ChangePassword(r.Context(), userID, body.CurrentPassword, body.NewPassword); err != nil {
		if err == domain.ErrUnauthorized {
			// 400, not 401: this request's own bearer token is fine (the
			// Auth middleware already accepted it) -- it's the *current
			// password field* that's wrong. The frontend treats any 401 on
			// an authenticated request as "your session expired, log back
			// in," which would be a confusing thing to show someone who
			// just mistyped their old password.
			httpresp.Error(w, http.StatusBadRequest, "current password is incorrect")
			return
		}
		httpresp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpresp.JSON(w, http.StatusOK, map[string]string{"status": "password_updated"})
}
