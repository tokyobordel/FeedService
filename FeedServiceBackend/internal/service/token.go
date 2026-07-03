package service

import (
	"traineesheep/feedservice/internal/model"
	"traineesheep/feedservice/internal/repository"
)

type TokenService struct {
	TokenDAO *repository.TokenDAO
}

func NewTokenService(tokenDAO *repository.TokenDAO) *TokenService {
	return &TokenService{TokenDAO: tokenDAO}
}

func (ts *TokenService) DeleteToken(token string) error {
	return ts.TokenDAO.DeleteToken(token)
}

func (ts *TokenService) GetRefreshToken(token string) (models.RefreshToken, error) {
	return ts.TokenDAO.GetRefreshToken(token)
}