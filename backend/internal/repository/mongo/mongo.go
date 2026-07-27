package mongorepo

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func replaceUpsert() *options.ReplaceOptionsBuilder {
	return options.Replace().SetUpsert(true)
}

// Connect dials MongoDB and returns the database handle used to construct
// every repository.
func Connect(uri, dbName string) (*mongo.Database, func(context.Context) error, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := client.Ping(ctx, nil); err != nil {
		return nil, nil, err
	}
	return client.Database(dbName), client.Disconnect, nil
}
