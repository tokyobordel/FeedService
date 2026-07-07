package service

import (
	"log"
	client "traineesheep/feedservice/internal/client/notify"
	"traineesheep/feedservice/internal/model"
	"traineesheep/feedservice/internal/repository"
	"traineesheep/feedservice/internal/utils"
)

// UserService предоставляет методы для работы с пользователями:
// создание, проверка существования, получение по имени или ID.
type UserService struct {
	UserDAO      *repository.UserDAO
	NotifyClient *client.NotifyClient
}

// NewUserService создаёт новый экземпляр UserService с переданным DAO.
func NewUserService(userDAO *repository.UserDAO, notifyClient *client.NotifyClient) *UserService {
	return &UserService{UserDAO: userDAO, NotifyClient: notifyClient}
}

// CreateUser создаёт нового пользователя на основе переданных данных
// и отправляет уведомление о регистрации
// Возвращает созданную модель пользователя и ошибку.
func (us *UserService) CreateUser(userdata utils.UserData) (models.User, error) {
	user, err := us.UserDAO.CreateUser(userdata)
	if err != nil {
		return models.User{}, err
	}
	err = us.NotifyClient.NotifyRegisterForAdmin(user.Username, user.Email)
	if err != nil {
		log.Println(err.Error())
	}
	err = us.NotifyClient.SendUserdataEmail(userdata.Username, userdata.Password, user.Email)
	if err != nil {
		return models.User{}, err
	}
	err = client.SendConfirmationEmail(user)
	if err != nil {
		return models.User{}, err
	}
	return user, nil
}

// ExistsByUsername проверяет, существует ли пользователь с указанным именем.
// Возвращает true, если пользователь найден, и ошибку при проблемах с БД.
func (us *UserService) ExistsByUsername(username string) (bool, error) {
	return us.UserDAO.ExistsByUsername(username)
}

// ExistsByUsername проверяет, существует ли пользователь с указанным email.
// Возвращает true, если пользователь найден, и ошибку при проблемах с БД.
func (us *UserService) ExistsByEmail(email string) (bool, error) {
	return us.UserDAO.ExistsByEmail(email)
}

// GetByUsername возвращает модель пользователя по его имени.
// Если пользователь не найден, возвращается пустая структура и ошибка sql.ErrNoRows.
func (us *UserService) GetByUsername(username string) (models.User, error) {
	return us.UserDAO.GetByUsername(username)
}

// GetByID возвращает модель пользователя по его идентификатору.
// Если пользователь не найден, возвращается пустая структура и ошибка sql.ErrNoRows.
func (us *UserService) GetByID(userID int) (models.User, error) {
	return us.UserDAO.GetByID(userID)
}

// ConfirmUserAccount подтверждает регистрацию пользователя.
func (us *UserService) ConfirmUserAccount(userID int) error {
	return us.UserDAO.ConfirmUserAccount(userID)
}
