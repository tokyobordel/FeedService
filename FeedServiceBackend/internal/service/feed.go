package service

import (
	"traineesheep/feedservice/internal/model"
	"traineesheep/feedservice/internal/repository"
)

type FeedService struct {
	FeedDAO *repository.FeedDAO
}

func NewFeedService(feedDAO *repository.FeedDAO) *FeedService {
	return &FeedService{FeedDAO: feedDAO}
}

func (fs *FeedService) LoadFeed() ([]models.Post, error) {
	return fs.FeedDAO.LoadFeed()
}

func (fs *FeedService) LoadUserFeed(userID int) ([]models.Post, error) {
	return fs.FeedDAO.LoadUserFeed(userID)
}

func (fs *FeedService) CreatePost(userID int, title string, description string, imageIDs []int) (models.Post, error) {
	return fs.FeedDAO.CreatePost(userID, title, description, imageIDs)
}