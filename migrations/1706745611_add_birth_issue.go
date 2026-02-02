package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Add birth_issue field to oracles collection
		// This field stores the GitHub issue URL used for verification
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		// birth_issue: GitHub issue URL from verification process
		oracles.Fields.Add(&core.URLField{Name: "birth_issue"})

		return app.Save(oracles)
	}, func(app core.App) error {
		// Rollback: remove the birth_issue field
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		oracles.Fields.RemoveByName("birth_issue")

		return app.Save(oracles)
	})
}
