// Package middleware предоставляет middleware-компоненты для Fiber-приложения,
// включая аутентификацию и авторизацию на основе JWT.
//
// Использует два токена:
//   - access_token (срок 5 минут) — для доступа к защищённым эндпоинтам,
//   - refresh_token (срок 10 минут) — для обновления access_token.
//
// Оба токена передаются в куках. Middleware AuthRequired проверяет access_token,
// RefreshTokenRequired — refresh_token. Секретный ключ подписи берётся из
// переменной окружения FEED_SERVICE_JWT_SECRET.
package middleware

import (
	"fmt"
	"strconv"
	"time"
	"traineesheep/feedservice/internal/utils"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// jwtSecret — секретный ключ для подписи JWT. По умолчанию используется
// значение, определённое в коде, но оно может быть переопределено через
// переменную окружения FEED_SERVICE_JWT_SECRET.
var jwtSecret = []byte(utils.GetEnv("FEED_SERVICE_JWT_SECRET",
	"Vj1WlmufcUengSqzIINyliPacXQXbSj0YqfTSYI3iWZ"))

// ConfirmRequired — middleware, требующий валидный token в параметрах запроса.
// Используется для подтверждения регистрации.
// При отсутствии или невалидном токене возвращает 500 с описанием ошибки.
var ConfirmRequired = jwtware.New(jwtware.Config{
	SigningKey:  jwtware.SigningKey{Key: jwtSecret},
	TokenLookup: "query:token",
	ErrorHandler: func(c *fiber.Ctx, err error) error {
		return c.Status(fiber.StatusInternalServerError).JSON(utils.ApiResponse{
			Success: false, ErrMessage: err.Error(),
		})
	},
})

// GenerateAccessToken создаёт подписанный JWT access_token для указанного
// пользователя. Токен действителен 5 минут.
func GenerateAccessToken(userID int) (string, error) {
	claims := jwt.MapClaims{
		"sub": strconv.Itoa(userID),
		"exp": time.Now().Add(5 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// GenerateConfirmToken создаёт подписанный JWT token
// для подтверждения регистрации указанного пользователя. Токен действителен 24 часа.
func GenerateConfirmToken(userID int) (string, error) {
	claims := jwt.MapClaims{
		"sub": strconv.Itoa(userID),
		"exp": time.Now().Add(24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ParseToken проверяет и разбирает JWT токен, возвращая ID пользователя (sub).
// В случае невалидного токена, неверной подписи или истечения срока возвращает
// ошибку и 0.
func ParseToken(tokenStr string) (int, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil,
				fmt.Errorf("неподдерживаемый метод подписи")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return 0, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, fmt.Errorf("неверные claims")
	}
	sub, _ := claims["sub"].(string)
	id, _ := strconv.Atoi(sub)
	return id, nil
}

// GenerateRefreshToken создаёт подписанный JWT refresh_token для указанного
// пользователя. Токен действителен 10 минут.
func GenerateRefreshToken(userID int) (string, error) {
	claims := jwt.MapClaims{
		"sub": strconv.Itoa(userID),
		"exp": time.Now().Add(10 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// TokenAuth — middleware для проверки и автоматического обновления access-токена
func TokenAuth(c *fiber.Ctx) error {
	// Пытаемся прочитать и распарсить access_token
	accessToken := c.Cookies("access_token")
	if accessToken != "" {
		claims, err := ParseToken(accessToken)
		if err == nil {
			// Токен валиден — продолжаем без лишних проверок
			c.Locals("user", claims)
			return c.Next()
		}
	}

	// access_token отсутствует или невалиден — пробуем обновиться через refresh_token
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return unauthorized(c, "refresh_token отсутствует")
	}

	refreshClaims, err := ParseToken(refreshToken)
	if err != nil {
		return unauthorized(c, "refresh_token невалидный")
	}

	// Генерируем новый access_token
	newAccessToken, err := GenerateAccessToken(refreshClaims)
	if err != nil {
		return unauthorized(c, "Ошибка генерации токена")
	}

	// Отправляем новый access_token клиенту
	utils.SetTokens(c, newAccessToken, "")

	// Сохраняем данные пользователя из refresh-токена. Прокидываем в эндпоинт
	c.Locals("user", refreshClaims)
	return c.Next()
}

// unauthorized — универсальный ответ 401
func unauthorized(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"success": false,
		"error":   message,
	})
}
