package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		humans, err := app.FindCollectionByNameOrId("humans")
		if err != nil {
			return err
		}

		// Add owner field - relation to humans collection
		// This links an Oracle to their human owner
		oracles.Fields.Add(&core.RelationField{
			Name:         "owner",
			CollectionId: humans.Id,
			Required:     false,
			MaxSelect:    1,
		})

		return app.Save(oracles)
	}, func(app core.App) error {
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		// Remove owner field on rollback
		oracles.Fields.RemoveByName("owner")

		return app.Save(oracles)
	})
}
