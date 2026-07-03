package models

type ImagePost struct {
	ID     	int `json:"id"`
	PostID 	int `json:"post_id"`
	ImageID int `json:"image_id"`
}