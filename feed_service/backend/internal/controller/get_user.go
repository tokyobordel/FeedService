package controller

import (
	"log"
	"traineesheep/feedservice/internal/utils"

	"github.com/gofiber/fiber/v2"
)

// GetUser обрабатывает GET-запрос данных текущего залогиненного пользователя.
func (ctrl *Controller) GetUser(c *fiber.Ctx) error {
	userID, ok := c.Locals("user").(int)

	if !ok {
		log.Println("Отсутствует ID внутри контекста")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Некорректные данные",
		})
	}

	user, userError := ctrl.UserService.GetByID(userID)

	if userError != nil {
		log.Println(userError)
		return c.Status(fiber.StatusInternalServerError).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Некорректные данные",
		})
	}

	return c.JSON(utils.ApiResponse{
		Data: fiber.Map{
			"user": user,
		},
		Success:    true,
		ErrMessage: "",
	})
}
