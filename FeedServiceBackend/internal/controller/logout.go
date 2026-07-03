package controller

import (
	"traineesheep/feedservice/internal/utils"

	"github.com/gofiber/fiber/v2"
)

func (ctrl *Controller) Logout(c *fiber.Ctx) error {
    var input struct {
        RefreshToken string `json:"refresh_token"`
    }
    if err := c.BodyParser(&input); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
            Success: false, ErrMessage: "Неверный формат запроса",
        })
    }

    if input.RefreshToken != "" {
        // Удаляем токен из БД (ошибки игнорируем — токен мог быть уже удалён)
        ctrl.TokenService.DeleteToken(input.RefreshToken)
    }

    return c.JSON(utils.ApiResponse{
        Success: true,
        Data:    nil,
        ErrMessage: "",
    })
}